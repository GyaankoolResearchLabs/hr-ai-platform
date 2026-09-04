import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Plus,
  RefreshCw,
  Search,
  Receipt,
  WalletCards,
  CheckCircle2,
  Clock3,
  XCircle,
  AlertCircle,
  ChevronRight,
  Trash2,
  Send,
  Ban,
  CreditCard,
  RotateCcw,
  FileText,
  CalendarDays,
  UserRound,
  IndianRupee,
  X,
  Save,
  Eye,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api";

const STATUS_META = {
  draft: {
    label: "Draft",
    className: "bg-slate-100 text-slate-700 border-slate-200",
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
    icon: AlertCircle,
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
    className: "bg-gray-100 text-gray-600 border-gray-200",
    icon: Ban,
  },
};

const POLICY_META = {
  not_checked: {
    label: "Not Checked",
    className: "bg-slate-100 text-slate-600",
  },
  compliant: {
    label: "Compliant",
    className: "bg-emerald-50 text-emerald-700",
  },
  warning: {
    label: "Warning",
    className: "bg-amber-50 text-amber-700",
  },
  violation: {
    label: "Violation",
    className: "bg-red-50 text-red-700",
  },
};

function getStatusMeta(status) {
  return (
    STATUS_META[String(status || "").toLowerCase()] || {
      label: status || "Unknown",
      className: "bg-slate-100 text-slate-700 border-slate-200",
      icon: AlertCircle,
    }
  );
}

function getPolicyMeta(status) {
  return (
    POLICY_META[String(status || "").toLowerCase()] || {
      label: status || "Not Checked",
      className: "bg-slate-100 text-slate-600",
    }
  );
}

function unwrapData(response) {
  return response?.data?.data ?? response?.data ?? response ?? null;
}

function getArray(response, keys = []) {
  const data = unwrapData(response);

  if (Array.isArray(data)) {
    return data;
  }

  for (const key of keys) {
    if (Array.isArray(data?.[key])) {
      return data[key];
    }
  }

  return [];
}

function getObject(response, keys = []) {
  const data = unwrapData(response);

  if (!data) {
    return null;
  }

  if (typeof data === "object" && !Array.isArray(data)) {
    for (const key of keys) {
      if (data[key] && typeof data[key] === "object") {
        return data[key];
      }
    }

    return data;
  }

  return null;
}

function formatCurrency(value, currency = "INR") {
  const amount = Number(value || 0);

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
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
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getErrorMessage(error, fallback = "Something went wrong.") {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
}

function normalizeEmployee(employee) {
  return {
    id: employee?.id || employee?.employee_id || employee?.user_id,
    name:
      employee?.name ||
      employee?.full_name ||
      employee?.employee_name ||
      "Unnamed Employee",
    email: employee?.email || "",
    employeeCode:
      employee?.employee_code ||
      employee?.employee_id ||
      employee?.employee_number ||
      "",
    department: employee?.department || employee?.department_name || "",
  };
}

function normalizeCategory(category) {
  return {
    ...category,
    id: category?.id,
    name: category?.name || "Unnamed Category",
    description: category?.description || "",
    is_active: category?.is_active !== false,
  };
}

function normalizeClaim(claim) {
  return {
    ...claim,
    id: claim?.id,
    claim_number: claim?.claim_number || "—",
    title: claim?.title || "Untitled Expense Claim",
    description: claim?.description || "",
    claim_date: claim?.claim_date,
    currency_code: claim?.currency_code || "INR",
    total_amount: Number(claim?.total_amount || 0),
    approved_amount: Number(claim?.approved_amount || 0),
    reimbursed_amount: Number(claim?.reimbursed_amount || 0),
    status: claim?.status || "draft",
    employee_id: claim?.employee_id,
    employee_name:
      claim?.employee_name ||
      claim?.employee?.name ||
      claim?.employee_snapshot?.name ||
      "",
    payroll_reconciliation_status:
      claim?.payroll_reconciliation_status || "unreconciled",
    created_at: claim?.created_at,
    updated_at: claim?.updated_at,
    submitted_at: claim?.submitted_at,
    approved_at: claim?.approved_at,
    rejected_at: claim?.rejected_at,
    paid_at: claim?.paid_at,
    reconciled_at: claim?.reconciled_at,
    rejection_reason: claim?.rejection_reason || "",
    payment_reference: claim?.payment_reference || "",
    notes: claim?.notes || "",
    items: Array.isArray(claim?.items)
      ? claim.items
      : Array.isArray(claim?.expense_claim_items)
        ? claim.expense_claim_items
        : [],
    receipts: Array.isArray(claim?.receipts)
      ? claim.receipts
      : Array.isArray(claim?.expense_receipts)
        ? claim.expense_receipts
        : [],
    events: Array.isArray(claim?.events)
      ? claim.events
      : Array.isArray(claim?.claim_events)
        ? claim.claim_events
        : [],
  };
}

function StatCard({ icon: Icon, label, value, description }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
          {description && (
            <p className="mt-1 text-xs text-slate-500">{description}</p>
          )}
        </div>

        <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const meta = getStatusMeta(status);
  const Icon = meta.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}
    >
      <Icon size={13} />
      {meta.label}
    </span>
  );
}

function PolicyBadge({ status }) {
  const meta = getPolicyMeta(status);

  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

export default function ReimbursementExpenseManager() {
  const navigate = useNavigate();

  const [claims, setClaims] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [categories, setCategories] = useState([]);

  const [selectedClaim, setSelectedClaim] = useState(null);

  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);

  const [claimForm, setClaimForm] = useState({
    employee_id: "",
    title: "",
    description: "",
    claim_date: new Date().toISOString().slice(0, 10),
    currency_code: "INR",
    notes: "",
  });

  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
  });

  const [itemForm, setItemForm] = useState({
    category_id: "",
    expense_date: new Date().toISOString().slice(0, 10),
    merchant_name: "",
    description: "",
    amount: "",
    currency_code: "INR",
    receipt_required: true,
    receipt_attached: false,
  });

  const [paymentReference, setPaymentReference] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const activeCategories = useMemo(
    () => categories.filter((category) => category.is_active !== false),
    [categories],
  );

  const filteredClaims = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return claims.filter((claim) => {
      const matchesStatus =
        statusFilter === "all" || claim.status === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!search) {
        return true;
      }

      return [
        claim.claim_number,
        claim.title,
        claim.employee_name,
        claim.description,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });
  }, [claims, searchTerm, statusFilter]);

  const summary = useMemo(() => {
    const totalClaims = claims.length;

    const submitted = claims.filter((claim) =>
      ["submitted", "under_review"].includes(claim.status),
    ).length;

    const approved = claims.filter((claim) =>
      ["approved", "partially_approved"].includes(claim.status),
    ).length;

    const paid = claims.filter((claim) =>
      ["paid", "reconciled"].includes(claim.status),
    ).length;

    const totalAmount = claims.reduce(
      (sum, claim) => sum + Number(claim.total_amount || 0),
      0,
    );

    const approvedAmount = claims.reduce(
      (sum, claim) => sum + Number(claim.approved_amount || 0),
      0,
    );

    const reimbursedAmount = claims.reduce(
      (sum, claim) => sum + Number(claim.reimbursed_amount || 0),
      0,
    );

    return {
      totalClaims,
      submitted,
      approved,
      paid,
      totalAmount,
      approvedAmount,
      reimbursedAmount,
    };
  }, [claims]);

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setLoading(true);
    setError("");

    try {
      await Promise.all([loadClaims(), loadEmployees(), loadCategories()]);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load reimbursement data."));
    } finally {
      setLoading(false);
    }
  }

  async function loadClaims() {
    const response = await api.get("/expense-claims");

    const list = getArray(response, ["claims", "items", "results"]);

    setClaims(list.map(normalizeClaim));
  }

  async function loadEmployees() {
    try {
      const response = await api.get("/expense-claims/employees");

      const list = getArray(response, ["employees", "items", "results"]);

      setEmployees(list.map(normalizeEmployee));
    } catch (err) {
      console.error("Failed to load employees:", err);
    }
  }

  async function loadCategories() {
    try {
      const response = await api.get("/expense-claims/categories");

      const list = getArray(response, ["categories", "items", "results"]);

      setCategories(list.map(normalizeCategory));
    } catch (err) {
      console.error("Failed to load expense categories:", err);
    }
  }

  async function refreshData() {
    setSuccessMessage("");
    setError("");

    try {
      await Promise.all([loadClaims(), loadCategories()]);
      setSuccessMessage("Expense data refreshed.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to refresh expense data."));
    }
  }

  async function openClaim(claimId) {
    if (!claimId) {
      return;
    }

    setDetailsLoading(true);
    setError("");

    try {
      const response = await api.get(`/expense-claims/${claimId}`);
      const claim = getObject(response, ["claim"]);

      setSelectedClaim(normalizeClaim(claim || unwrapData(response)));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load claim details."));
    } finally {
      setDetailsLoading(false);
    }
  }

  function resetClaimForm() {
    setClaimForm({
      employee_id: "",
      title: "",
      description: "",
      claim_date: new Date().toISOString().slice(0, 10),
      currency_code: "INR",
      notes: "",
    });
  }

  function resetCategoryForm() {
    setCategoryForm({
      name: "",
      description: "",
    });
  }

  function resetItemForm() {
    setItemForm({
      category_id: activeCategories[0]?.id || "",
      expense_date: new Date().toISOString().slice(0, 10),
      merchant_name: "",
      description: "",
      amount: "",
      currency_code: selectedClaim?.currency_code || "INR",
      receipt_required: true,
      receipt_attached: false,
    });
  }

  async function createClaim(event) {
    event.preventDefault();

    if (!claimForm.employee_id) {
      setError("Please select an employee.");
      return;
    }

    if (!claimForm.title.trim()) {
      setError("Please enter a claim title.");
      return;
    }

    if (!claimForm.claim_date) {
      setError("Please select the claim date.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await api.post("/expense-claims", {
        employee_id: claimForm.employee_id,
        title: claimForm.title.trim(),
        description: claimForm.description.trim() || null,
        claim_date: claimForm.claim_date,
        currency_code: claimForm.currency_code,
        notes: claimForm.notes.trim() || null,
      });

      const created = normalizeClaim(
        getObject(response, ["claim"]) || unwrapData(response),
      );

      setShowCreateModal(false);
      resetClaimForm();

      await loadClaims();

      if (created?.id) {
        await openClaim(created.id);
      }

      setSuccessMessage(
        created?.claim_number
          ? `${created.claim_number} created successfully.`
          : "Expense claim created successfully.",
      );
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create expense claim."));
    } finally {
      setSaving(false);
    }
  }

  async function createCategory(event) {
    event.preventDefault();

    if (!categoryForm.name.trim()) {
      setError("Enter a category name.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      await api.post("/expense-claims/categories", {
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim() || null,
      });

      await loadCategories();

      setShowCategoryModal(false);
      resetCategoryForm();

      setSuccessMessage("Expense category created successfully.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create expense category."));
    } finally {
      setSaving(false);
    }
  }

  async function addClaimItem(event) {
    event.preventDefault();

    if (!selectedClaim?.id) {
      setError("Select an expense claim first.");
      return;
    }

    if (!itemForm.description.trim()) {
      setError("Enter an expense description.");
      return;
    }

    if (!itemForm.amount || Number(itemForm.amount) <= 0) {
      setError("Enter a valid expense amount.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      await api.post(`/expense-claims/${selectedClaim.id}/items`, {
        category_id: itemForm.category_id || null,
        expense_date: itemForm.expense_date,
        merchant_name: itemForm.merchant_name.trim() || null,
        description: itemForm.description.trim(),
        amount: Number(itemForm.amount),
        currency_code:
          itemForm.currency_code || selectedClaim.currency_code || "INR",
        receipt_required: Boolean(itemForm.receipt_required),
        receipt_attached: Boolean(itemForm.receipt_attached),
      });

      setShowItemModal(false);

      await loadClaims();
      await openClaim(selectedClaim.id);

      resetItemForm();

      setSuccessMessage("Expense item added successfully.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to add expense item."));
    } finally {
      setSaving(false);
    }
  }

  async function deleteClaimItem(itemId) {
    if (!itemId || !selectedClaim?.id) {
      return;
    }

    const confirmed = window.confirm(
      "Remove this expense item from the claim?",
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      await api.delete(`/expense-claims/items/${itemId}`);

      await loadClaims();
      await openClaim(selectedClaim.id);

      setSuccessMessage("Expense item removed.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to remove expense item."));
    } finally {
      setSaving(false);
    }
  }

  async function submitClaim() {
    if (!selectedClaim?.id) {
      return;
    }

    if (!selectedClaim.items?.length) {
      setError("Add at least one expense item before submitting.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      await api.post(`/expense-claims/${selectedClaim.id}/submit`);

      await loadClaims();
      await openClaim(selectedClaim.id);

      setSuccessMessage("Expense claim submitted for review.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to submit the expense claim."));
    } finally {
      setSaving(false);
    }
  }

  async function reviewClaim() {
    if (!selectedClaim?.id) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      await api.post(`/expense-claims/${selectedClaim.id}/review`);

      await loadClaims();
      await openClaim(selectedClaim.id);

      setSuccessMessage("Expense claim moved to review.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to review the expense claim."));
    } finally {
      setSaving(false);
    }
  }

  async function approveClaim() {
    if (!selectedClaim?.id) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      await api.post(`/expense-claims/${selectedClaim.id}/approve`);

      await loadClaims();
      await openClaim(selectedClaim.id);

      setSuccessMessage("Expense claim approved.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to approve the expense claim."));
    } finally {
      setSaving(false);
    }
  }

  async function rejectClaim() {
    if (!selectedClaim?.id) {
      return;
    }

    if (!rejectionReason.trim()) {
      setError("Enter a rejection reason.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      await api.post(`/expense-claims/${selectedClaim.id}/reject`, {
        rejection_reason: rejectionReason.trim(),
      });

      setRejectionReason("");

      await loadClaims();
      await openClaim(selectedClaim.id);

      setSuccessMessage("Expense claim rejected.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to reject the expense claim."));
    } finally {
      setSaving(false);
    }
  }

  async function payClaim() {
    if (!selectedClaim?.id) {
      return;
    }

    if (!paymentReference.trim()) {
      setError("Enter a payment reference before marking the claim as paid.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      await api.post(`/expense-claims/${selectedClaim.id}/pay`, {
        payment_reference: paymentReference.trim(),
      });

      setPaymentReference("");

      await loadClaims();
      await openClaim(selectedClaim.id);

      setSuccessMessage("Expense claim marked as paid.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to mark the claim as paid."));
    } finally {
      setSaving(false);
    }
  }

  async function reconcileClaim() {
    if (!selectedClaim?.id) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      await api.post(`/expense-claims/${selectedClaim.id}/reconcile`);

      await loadClaims();
      await openClaim(selectedClaim.id);

      setSuccessMessage("Expense claim reconciliation completed.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to reconcile the expense claim."));
    } finally {
      setSaving(false);
    }
  }

  async function cancelClaim() {
    if (!selectedClaim?.id) {
      return;
    }

    const confirmed = window.confirm(
      "Cancel this expense claim? This action cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      await api.post(`/expense-claims/${selectedClaim.id}/cancel`);

      await loadClaims();
      await openClaim(selectedClaim.id);

      setSuccessMessage("Expense claim cancelled.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to cancel the expense claim."));
    } finally {
      setSaving(false);
    }
  }

  async function deleteClaim() {
    if (!selectedClaim?.id) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this draft expense claim permanently?",
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      await api.delete(`/expense-claims/${selectedClaim.id}`);

      setSelectedClaim(null);
      await loadClaims();

      setSuccessMessage("Draft expense claim deleted.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete the expense claim."));
    } finally {
      setSaving(false);
    }
  }

  function employeeName(employeeId) {
    const employee = employees.find((item) => item.id === employeeId);

    return employee?.name || selectedClaim?.employee_name || "Employee";
  }

  function categoryName(categoryId) {
    const category = categories.find((item) => item.id === categoryId);

    return category?.name || "Uncategorized";
  }

  function canEditClaim(claim) {
    return claim?.status === "draft";
  }

  function canSubmitClaim(claim) {
    return ["draft"].includes(claim?.status);
  }

  function canReviewClaim(claim) {
    return ["submitted"].includes(claim?.status);
  }

  function canApproveClaim(claim) {
    return ["submitted", "under_review"].includes(claim?.status);
  }

  function canRejectClaim(claim) {
    return ["submitted", "under_review"].includes(claim?.status);
  }

  function canPayClaim(claim) {
    return ["approved", "partially_approved"].includes(claim?.status);
  }

  function canReconcileClaim(claim) {
    return (
      ["paid"].includes(claim?.status) &&
      claim?.payroll_reconciliation_status !== "reconciled"
    );
  }

  function canCancelClaim(claim) {
    return ["draft", "submitted", "under_review"].includes(claim?.status);
  }

  const selectedItems = selectedClaim?.items || [];

  const selectedTotal = selectedItems.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <button
              type="button"
              onClick={() => navigate("/app/dashboard")}
              className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
              title="Back to Dashboard"
            >
              <ArrowLeft size={19} />
            </button>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-xl bg-slate-900 p-2 text-white">
                  <WalletCards size={20} />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Payroll & Expense Management
                  </p>

                  <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                    Reimbursement & Expense Manager
                  </h1>
                </div>
              </div>

              <p className="mt-2 max-w-3xl text-sm text-slate-500">
                Submit, approve, and reconcile employee expense claims using
                real organization data.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={refreshData}
              disabled={loading || saving}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => {
                resetClaimForm();
                setShowCreateModal(true);
                setError("");
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              <Plus size={17} />
              New Expense Claim
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <div className="min-w-0 flex-1">{error}</div>

            <button
              type="button"
              onClick={() => setError("")}
              className="shrink-0 text-red-500 hover:text-red-700"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
            <div className="min-w-0 flex-1">{successMessage}</div>

            <button
              type="button"
              onClick={() => setSuccessMessage("")}
              className="shrink-0 text-emerald-500 hover:text-emerald-700"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Receipt}
            label="Total Claims"
            value={summary.totalClaims}
            description={`${summary.submitted} currently awaiting review`}
          />

          <StatCard
            icon={IndianRupee}
            label="Claimed Amount"
            value={formatCurrency(summary.totalAmount)}
            description={`${formatCurrency(summary.approvedAmount)} approved`}
          />

          <StatCard
            icon={CheckCircle2}
            label="Approved Claims"
            value={summary.approved}
            description="Approved or partially approved"
          />

          <StatCard
            icon={CreditCard}
            label="Reimbursed"
            value={formatCurrency(summary.reimbursedAmount)}
            description={`${summary.paid} paid or reconciled`}
          />
        </div>

        {/* Main */}
        <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,520px)]">
          {/* Claims list */}
          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Expense Claims
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    All claims belonging to your organization.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCategoryModal(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Plus size={16} />
                  Add Category
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_200px]">
                <div className="relative">
                  <Search
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search claim number, title, or employee..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
                >
                  <option value="all">All statuses</option>
                  {Object.entries(STATUS_META).map(([value, meta]) => (
                    <option key={value} value={value}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[420px] items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <RefreshCw size={18} className="animate-spin" />
                  Loading expense claims...
                </div>
              </div>
            ) : filteredClaims.length === 0 ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
                <div className="rounded-2xl bg-slate-100 p-4 text-slate-500">
                  <Receipt size={28} />
                </div>

                <h3 className="mt-4 text-base font-bold text-slate-900">
                  No expense claims found
                </h3>

                <p className="mt-1 max-w-md text-sm text-slate-500">
                  Create the first expense claim or adjust the current search
                  and status filters.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    resetClaimForm();
                    setShowCreateModal(true);
                  }}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  <Plus size={16} />
                  Create Expense Claim
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px]">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-3">Claim</th>
                      <th className="px-5 py-3">Employee</th>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3 text-right">Amount</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredClaims.map((claim) => {
                      const active =
                        selectedClaim?.id && selectedClaim.id === claim.id;

                      return (
                        <tr
                          key={claim.id}
                          className={`transition ${
                            active ? "bg-slate-50" : "hover:bg-slate-50/70"
                          }`}
                        >
                          <td className="px-5 py-4">
                            <button
                              type="button"
                              onClick={() => openClaim(claim.id)}
                              className="text-left"
                            >
                              <div className="font-semibold text-slate-900">
                                {claim.claim_number}
                              </div>
                              <div className="mt-0.5 max-w-[260px] truncate text-sm text-slate-500">
                                {claim.title}
                              </div>
                            </button>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                                <UserRound size={15} />
                              </div>

                              <div>
                                <div className="text-sm font-medium text-slate-800">
                                  {claim.employee_name ||
                                    employeeName(claim.employee_id)}
                                </div>

                                {claim.employee_id && (
                                  <div className="text-xs text-slate-400">
                                    Employee record
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600">
                            {formatDate(claim.claim_date)}
                          </td>

                          <td className="px-5 py-4 text-right">
                            <div className="font-semibold text-slate-900">
                              {formatCurrency(
                                claim.total_amount,
                                claim.currency_code,
                              )}
                            </div>

                            {claim.approved_amount > 0 && (
                              <div className="mt-0.5 text-xs text-emerald-600">
                                Approved{" "}
                                {formatCurrency(
                                  claim.approved_amount,
                                  claim.currency_code,
                                )}
                              </div>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <StatusBadge status={claim.status} />
                          </td>

                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => openClaim(claim.id)}
                              className="inline-flex items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                              title="View claim"
                            >
                              <ChevronRight size={18} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Details */}
          <aside className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
            {!selectedClaim ? (
              <div className="flex min-h-[520px] flex-col items-center justify-center px-8 text-center">
                <div className="rounded-2xl bg-slate-100 p-4 text-slate-500">
                  <Eye size={28} />
                </div>

                <h3 className="mt-4 text-base font-bold text-slate-900">
                  Select an expense claim
                </h3>

                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  Select a claim from the list to view its items, approval
                  status, reimbursement details, and activity.
                </p>
              </div>
            ) : detailsLoading ? (
              <div className="flex min-h-[520px] items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <RefreshCw size={18} className="animate-spin" />
                  Loading claim...
                </div>
              </div>
            ) : (
              <div className="flex min-h-[520px] flex-col">
                <div className="border-b border-slate-200 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-lg font-bold text-slate-900">
                          {selectedClaim.claim_number}
                        </h2>

                        <StatusBadge status={selectedClaim.status} />
                      </div>

                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {selectedClaim.title}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Created {formatDateTime(selectedClaim.created_at)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedClaim(null)}
                      className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                  {/* Claim summary */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Employee</p>
                      <p className="mt-1 truncate text-sm font-semibold text-slate-800">
                        {selectedClaim.employee_name ||
                          employeeName(selectedClaim.employee_id)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Claim Date</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {formatDate(selectedClaim.claim_date)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Claimed</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {formatCurrency(
                          selectedClaim.total_amount,
                          selectedClaim.currency_code,
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Approved</p>
                      <p className="mt-1 text-sm font-semibold text-emerald-700">
                        {formatCurrency(
                          selectedClaim.approved_amount,
                          selectedClaim.currency_code,
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  {(selectedClaim.description || selectedClaim.notes) && (
                    <div className="mt-5 space-y-3">
                      {selectedClaim.description && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Description
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                            {selectedClaim.description}
                          </p>
                        </div>
                      )}

                      {selectedClaim.notes && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Notes
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                            {selectedClaim.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expense items */}
                  <div className="mt-6">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Expense Items
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {selectedItems.length} item
                          {selectedItems.length === 1 ? "" : "s"} in this
                          claim
                        </p>
                      </div>

                      {canEditClaim(selectedClaim) && (
                        <button
                          type="button"
                          onClick={() => {
                            resetItemForm();
                            setShowItemModal(true);
                            setError("");
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Plus size={14} />
                          Add Item
                        </button>
                      )}
                    </div>

                    {selectedItems.length === 0 ? (
                      <div className="mt-3 rounded-xl border border-dashed border-slate-300 p-5 text-center">
                        <Receipt
                          size={22}
                          className="mx-auto text-slate-400"
                        />

                        <p className="mt-2 text-sm font-medium text-slate-700">
                          No expense items
                        </p>

                        {canEditClaim(selectedClaim) && (
                          <p className="mt-1 text-xs text-slate-500">
                            Add expense items before submitting this claim.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {selectedItems.map((item, index) => (
                          <div
                            key={item.id || `${item.description}-${index}`}
                            className="rounded-xl border border-slate-200 p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-slate-800">
                                    {item.description || "Expense"}
                                  </p>

                                  <PolicyBadge
                                    status={
                                      item.policy_status || "not_checked"
                                    }
                                  />
                                </div>

                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                                  <span>
                                    {formatDate(item.expense_date)}
                                  </span>

                                  {item.merchant_name && (
                                    <span>{item.merchant_name}</span>
                                  )}

                                  <span>
                                    {categoryName(item.category_id)}
                                  </span>
                                </div>

                                {item.policy_message && (
                                  <p className="mt-2 text-xs text-slate-500">
                                    {item.policy_message}
                                  </p>
                                )}
                              </div>

                              <div className="shrink-0 text-right">
                                <p className="text-sm font-bold text-slate-900">
                                  {formatCurrency(
                                    item.amount,
                                    item.currency_code ||
                                      selectedClaim.currency_code,
                                  )}
                                </p>

                                {canEditClaim(selectedClaim) && item.id && (
                                  <button
                                    type="button"
                                    onClick={() => deleteClaimItem(item.id)}
                                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 size={13} />
                                    Remove
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}

                        <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                          <span className="text-sm font-semibold text-slate-600">
                            Items Total
                          </span>

                          <span className="text-base font-bold text-slate-900">
                            {formatCurrency(
                              selectedTotal,
                              selectedClaim.currency_code,
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Reimbursement */}
                  <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-sm font-bold text-slate-900">
                      Reimbursement
                    </h3>

                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-slate-500">Approved</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {formatCurrency(
                            selectedClaim.approved_amount,
                            selectedClaim.currency_code,
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">Reimbursed</p>
                        <p className="mt-1 text-sm font-semibold text-emerald-700">
                          {formatCurrency(
                            selectedClaim.reimbursed_amount,
                            selectedClaim.currency_code,
                          )}
                        </p>
                      </div>
                    </div>

                    {selectedClaim.payment_reference && (
                      <div className="mt-3 border-t border-slate-200 pt-3">
                        <p className="text-xs text-slate-500">
                          Payment Reference
                        </p>
                        <p className="mt-1 break-all text-sm font-medium text-slate-800">
                          {selectedClaim.payment_reference}
                        </p>
                      </div>
                    )}

                    <div className="mt-3 border-t border-slate-200 pt-3">
                      <p className="text-xs text-slate-500">
                        Payroll Reconciliation
                      </p>

                      <p className="mt-1 text-sm font-semibold capitalize text-slate-800">
                        {String(
                          selectedClaim.payroll_reconciliation_status ||
                            "unreconciled",
                        ).replaceAll("_", " ")}
                      </p>
                    </div>
                  </div>

                  {/* Rejection reason */}
                  {selectedClaim.rejection_reason && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                        Rejection Reason
                      </p>

                      <p className="mt-1 whitespace-pre-wrap text-sm text-red-800">
                        {selectedClaim.rejection_reason}
                      </p>
                    </div>
                  )}

                  {/* Receipt metadata */}
                  {selectedClaim.receipts?.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-sm font-bold text-slate-900">
                        Receipts
                      </h3>

                      <div className="mt-3 space-y-2">
                        {selectedClaim.receipts.map((receipt) => (
                          <div
                            key={receipt.id}
                            className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"
                          >
                            <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
                              <FileText size={16} />
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-800">
                                {receipt.file_name || "Receipt"}
                              </p>

                              <p className="text-xs text-slate-500">
                                {receipt.file_type || "File"}{" "}
                                {receipt.file_size
                                  ? `• ${Math.round(
                                      Number(receipt.file_size) / 1024,
                                    )} KB`
                                  : ""}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Activity */}
                  {selectedClaim.events?.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-sm font-bold text-slate-900">
                        Activity
                      </h3>

                      <div className="mt-3 space-y-3">
                        {selectedClaim.events
                          .slice()
                          .sort(
                            (a, b) =>
                              new Date(b.created_at || 0) -
                              new Date(a.created_at || 0),
                          )
                          .map((event, index) => (
                            <div
                              key={event.id || index}
                              className="relative border-l border-slate-200 pl-4"
                            >
                              <div className="absolute -left-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-slate-400" />

                              <p className="text-sm font-medium text-slate-800">
                                {event.message ||
                                  event.event_type ||
                                  "Claim updated"}
                              </p>

                              <p className="mt-0.5 text-xs text-slate-500">
                                {formatDateTime(event.created_at)}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="border-t border-slate-200 bg-slate-50 p-4">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {canSubmitClaim(selectedClaim) && (
                      <button
                        type="button"
                        onClick={submitClaim}
                        disabled={saving}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Send size={16} />
                        Submit Claim
                      </button>
                    )}

                    {canReviewClaim(selectedClaim) && (
                      <button
                        type="button"
                        onClick={reviewClaim}
                        disabled={saving}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Clock3 size={16} />
                        Start Review
                      </button>
                    )}

                    {canApproveClaim(selectedClaim) && (
                      <button
                        type="button"
                        onClick={approveClaim}
                        disabled={saving}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <CheckCircle2 size={16} />
                        Approve
                      </button>
                    )}

                    {canRejectClaim(selectedClaim) && (
                      <div className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 p-3">
                        <label className="text-xs font-semibold text-red-800">
                          Rejection reason
                        </label>

                        <textarea
                          value={rejectionReason}
                          onChange={(event) =>
                            setRejectionReason(event.target.value)
                          }
                          rows={2}
                          placeholder="Explain why this claim is being rejected..."
                          className="mt-2 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-red-400"
                        />

                        <button
                          type="button"
                          onClick={rejectClaim}
                          disabled={saving}
                          className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <XCircle size={15} />
                          Reject Claim
                        </button>
                      </div>
                    )}

                    {canPayClaim(selectedClaim) && (
                      <div className="sm:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                        <label className="text-xs font-semibold text-emerald-800">
                          Payment reference
                        </label>

                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                          <input
                            type="text"
                            value={paymentReference}
                            onChange={(event) =>
                              setPaymentReference(event.target.value)
                            }
                            placeholder="Bank transaction / payment reference"
                            className="min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-400"
                          />

                          <button
                            type="button"
                            onClick={payClaim}
                            disabled={saving}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <CreditCard size={15} />
                            Mark Paid
                          </button>
                        </div>
                      </div>
                    )}

                    {canReconcileClaim(selectedClaim) && (
                      <button
                        type="button"
                        onClick={reconcileClaim}
                        disabled={saving}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <RotateCcw size={16} />
                        Reconcile
                      </button>
                    )}

                    {canCancelClaim(selectedClaim) && (
                      <button
                        type="button"
                        onClick={cancelClaim}
                        disabled={saving}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Ban size={16} />
                        Cancel
                      </button>
                    )}

                    {canEditClaim(selectedClaim) && (
                      <button
                        type="button"
                        onClick={deleteClaim}
                        disabled={saving}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 size={16} />
                        Delete Draft
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Create Claim Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  New Expense Claim
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Create a claim using an existing employee record.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={createClaim} className="space-y-5 p-5">
              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Employee
                </label>

                <select
                  value={claimForm.employee_id}
                  onChange={(event) =>
                    setClaimForm((current) => ({
                      ...current,
                      employee_id: event.target.value,
                    }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400"
                >
                  <option value="">Select employee</option>

                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                      {employee.employeeCode
                        ? ` — ${employee.employeeCode}`
                        : ""}
                      {employee.department
                        ? ` — ${employee.department}`
                        : ""}
                    </option>
                  ))}
                </select>

                {employees.length === 0 && (
                  <p className="mt-1.5 text-xs text-amber-600">
                    No employee records were returned by the organization
                    API.
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Claim Title
                </label>

                <input
                  type="text"
                  value={claimForm.title}
                  onChange={(event) =>
                    setClaimForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="e.g. Client visit travel expenses"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Claim Date
                  </label>

                  <div className="relative mt-1.5">
                    <CalendarDays
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      type="date"
                      value={claimForm.claim_date}
                      onChange={(event) =>
                        setClaimForm((current) => ({
                          ...current,
                          claim_date: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pl-9 text-sm outline-none focus:border-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Currency
                  </label>

                  <select
                    value={claimForm.currency_code}
                    onChange={(event) =>
                      setClaimForm((current) => ({
                        ...current,
                        currency_code: event.target.value,
                      }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                  >
                    <option value="INR">INR — Indian Rupee</option>
                    <option value="USD">USD — US Dollar</option>
                    <option value="EUR">EUR — Euro</option>
                    <option value="GBP">GBP — British Pound</option>
                    <option value="AED">AED — UAE Dirham</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Description
                </label>

                <textarea
                  value={claimForm.description}
                  onChange={(event) =>
                    setClaimForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Describe the business purpose of the expenses..."
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Notes
                </label>

                <textarea
                  value={claimForm.notes}
                  onChange={(event) =>
                    setClaimForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  rows={2}
                  placeholder="Optional internal notes..."
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save size={16} />
                  {saving ? "Creating..." : "Create Claim"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Add Expense Category
                </h2>

                <p className="mt-0.5 text-sm text-slate-500">
                  Create a reusable category for expense items.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={createCategory} className="space-y-4 p-5">
              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Category Name
                </label>

                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(event) =>
                    setCategoryForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="e.g. Travel"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Description
                </label>

                <textarea
                  value={categoryForm.description}
                  onChange={(event) =>
                    setCategoryForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Optional category description..."
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save size={16} />
                  {saving ? "Saving..." : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showItemModal && selectedClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Add Expense Item
                </h2>

                <p className="mt-0.5 text-sm text-slate-500">
                  Add an individual expense to {selectedClaim.claim_number}.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowItemModal(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={addClaimItem} className="space-y-5 p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Category
                  </label>

                  <select
                    value={itemForm.category_id}
                    onChange={(event) =>
                      setItemForm((current) => ({
                        ...current,
                        category_id: event.target.value,
                      }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                  >
                    <option value="">Uncategorized</option>

                    {activeCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Expense Date
                  </label>

                  <input
                    type="date"
                    value={itemForm.expense_date}
                    onChange={(event) =>
                      setItemForm((current) => ({
                        ...current,
                        expense_date: event.target.value,
                      }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Merchant
                </label>

                <input
                  type="text"
                  value={itemForm.merchant_name}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      merchant_name: event.target.value,
                    }))
                  }
                  placeholder="e.g. Hotel, airline, restaurant..."
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Amount
                  </label>

                  <div className="relative mt-1.5">
                    <IndianRupee
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={itemForm.amount}
                      onChange={(event) =>
                        setItemForm((current) => ({
                          ...current,
                          amount: event.target.value,
                        }))
                      }
                      placeholder="0.00"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pl-9 text-sm outline-none focus:border-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Currency
                  </label>

                  <select
                    value={itemForm.currency_code}
                    onChange={(event) =>
                      setItemForm((current) => ({
                        ...current,
                        currency_code: event.target.value,
                      }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="AED">AED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Expense Description
                </label>

                <textarea
                  value={itemForm.description}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Describe what the expense was for..."
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Receipt required
                    </p>

                    <p className="mt-0.5 text-xs text-slate-500">
                      Mark whether this expense requires a receipt.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setItemForm((current) => ({
                        ...current,
                        receipt_required: !current.receipt_required,
                      }))
                    }
                    className={`relative h-6 w-11 rounded-full transition ${
                      itemForm.receipt_required
                        ? "bg-slate-900"
                        : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                        itemForm.receipt_required ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>

                {itemForm.receipt_required && (
                  <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={itemForm.receipt_attached}
                      onChange={(event) =>
                        setItemForm((current) => ({
                          ...current,
                          receipt_attached: event.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Receipt is attached
                  </label>
                )}
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={16} />
                  {saving ? "Adding..." : "Add Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}