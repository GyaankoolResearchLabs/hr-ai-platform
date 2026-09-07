import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  File,
  FileText,
  Loader2,
  Upload,
  X,
  XCircle,
} from "lucide-react";

import employeeMyDocumentsService from "../services/employeeMyDocumentsService";

const SELF_UPLOADABLE_TYPES = [
  { value: "aadhaar", label: "Aadhaar" },
  { value: "pan", label: "PAN" },
  { value: "passport", label: "Passport" },
  { value: "bank_proof", label: "Bank Proof" },
  { value: "address_proof", label: "Address Proof" },
  { value: "education_certificate", label: "Education Certificate" },
  { value: "experience_certificate", label: "Experience Certificate" },
  { value: "other", label: "Other" },
];

const NUMBER_REQUIRED_TYPES = ["aadhaar", "pan", "passport"];

const VERIFICATION_META = {
  verified: {
    label: "Verified",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  pending: {
    label: "Pending Review",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock3,
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-50 text-red-700 border-red-200",
    icon: XCircle,
  },
  generated: {
    label: "Issued by HR",
    className: "bg-blue-50 text-blue-700 border-blue-200",
    icon: FileText,
  },
};

function getStatusMeta(doc) {
  const key = doc.source === "generated" ? "generated" : doc.verification_status;

  return (
    VERIFICATION_META[key] || {
      label: key || "Unknown",
      className: "bg-ink-50 text-ink-600 border-ink-200",
      icon: File,
    }
  );
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

const EMPTY_FORM = {
  document_type: SELF_UPLOADABLE_TYPES[0].value,
  document_number: "",
  notes: "",
};

export default function EmployeeDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  async function loadDocuments() {
    try {
      setLoading(true);
      setError("");

      const data = await employeeMyDocumentsService.list();

      setDocuments(data);
    } catch (err) {
      console.error("Employee documents load error:", err);

      setError(
        err?.response?.data?.message ||
          "Unable to load your documents.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDocuments();
  }, []);

  async function openDocument(id) {
    setSelectedId(id);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);

    try {
      const data = await employeeMyDocumentsService.getById(id);

      setDetail(data);
    } catch (err) {
      console.error("Document detail load error:", err);

      setDetailError(
        err?.response?.data?.message ||
          "Unable to load this document.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDocument() {
    setSelectedId(null);
    setDetail(null);
    setDetailError("");
  }

  function viewFile() {
    if (!detail?.url) {
      return;
    }

    // No "noopener" here on purpose — see EmployeeReimbursements.jsx.
    // The destination is always our own signed Supabase URL.
    window.open(detail.url, "_blank");
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleFileChange(e) {
    setFile(e.target.files?.[0] || null);
  }

  async function handleUpload(e) {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!file) {
      setFormError("Choose a file to upload.");
      return;
    }

    if (
      NUMBER_REQUIRED_TYPES.includes(form.document_type) &&
      !form.document_number.trim()
    ) {
      setFormError("Document number is required for this document type.");
      return;
    }

    try {
      setUploading(true);

      const uploaded = await employeeMyDocumentsService.upload({
        documentType: form.document_type,
        documentNumber: form.document_number.trim() || null,
        notes: form.notes.trim() || null,
        file,
      });

      setDocuments((current) => [uploaded, ...current]);
      setForm(EMPTY_FORM);
      setFile(null);
      document.getElementById("document-file-input").value = "";

      setFormSuccess(`${uploaded.name} uploaded and pending HR review.`);
    } catch (err) {
      console.error("Document upload error:", err);

      setFormError(
        err?.response?.data?.message ||
          "Unable to upload your document.",
      );
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-ink-500">
          <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
          Loading your documents...
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
            Documents
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Letters issued by HR and documents you've submitted.
          </p>
        </div>

        <button
          type="button"
          onClick={loadDocuments}
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
        {documents.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-ink-500">
            No documents yet.
          </div>
        ) : (
          <div className="divide-y divide-ink-100">
            {documents.map((doc) => {
              const status = getStatusMeta(doc);
              const StatusIcon = status.icon;

              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => openDocument(doc.id)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-ink-50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                      <FileText className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900">
                        {doc.name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-ink-500">
                        {formatDate(doc.created_at)}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${status.className}`}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selectedId && (
        <DocumentModal
          loading={detailLoading}
          error={detailError}
          detail={detail}
          onClose={closeDocument}
          onView={viewFile}
        />
      )}

      {/* =====================================================
          UPLOAD
      ===================================================== */}

      <section className="card p-5">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Upload className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-ink-950">
              Submit a Document
            </h2>
            <p className="text-sm text-ink-500">
              ID proofs and certificates only (JPG, PNG, WEBP or PDF, up
              to 5MB) — offer/experience letters are issued by HR.
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

        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-400">
                Document type
              </label>
              <select
                value={form.document_type}
                onChange={(e) =>
                  updateField("document_type", e.target.value)
                }
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              >
                {SELF_UPLOADABLE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-400">
                Document number
                {NUMBER_REQUIRED_TYPES.includes(form.document_type)
                  ? ""
                  : " (optional)"}
              </label>
              <input
                type="text"
                value={form.document_number}
                onChange={(e) =>
                  updateField("document_number", e.target.value)
                }
                placeholder="e.g. 1234 5678 9012"
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-1">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-400">
                File
              </label>
              <label
                htmlFor="document-file-input"
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed border-ink-200 px-3 py-2 text-sm text-ink-600 transition hover:bg-ink-50"
              >
                <Upload className="h-4 w-4 shrink-0 text-ink-400" />
                <span className="truncate">
                  {file ? file.name : "Choose file"}
                </span>
              </label>
              <input
                id="document-file-input"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-400">
                Notes (optional)
              </label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="e.g. Updated address proof"
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-900 disabled:opacity-60"
          >
            {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            Upload document
          </button>
        </form>
      </section>
    </div>
  );
}

function DocumentModal({ loading, error, detail, onClose, onView }) {
  const status = detail ? getStatusMeta(detail) : null;
  const StatusIcon = status?.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-ink-100 px-5 py-4">
          <h2 className="text-base font-semibold text-ink-950">
            {detail?.name || "Document"}
          </h2>

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
            <div className="flex min-h-[160px] items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && detail && (
            <div className="space-y-4">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${status.className}`}
              >
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </span>

              {detail.source === "uploaded" && (
                <div className="space-y-3 text-sm">
                  <Row label="File name" value={detail.file_name} />
                  <Row
                    label="Document number"
                    value={
                      detail.document_number_last4
                        ? `Ending in ${detail.document_number_last4}`
                        : "-"
                    }
                  />
                  <Row label="Notes" value={detail.notes || "-"} />
                  <Row
                    label="Submitted"
                    value={formatDate(detail.created_at)}
                  />

                  {detail.url ? (
                    <button
                      type="button"
                      onClick={onView}
                      className="inline-flex items-center gap-2 rounded-lg bg-brand-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-900"
                    >
                      <File className="h-4 w-4" />
                      View document
                    </button>
                  ) : (
                    <p className="text-sm text-ink-400">
                      No file is attached to this record.
                    </p>
                  )}
                </div>
              )}

              {detail.source === "generated" && (
                <div className="space-y-3 rounded-lg bg-ink-50 p-4 text-sm text-ink-800">
                  {detail.content?.subject && (
                    <p className="font-semibold text-ink-950">
                      {detail.content.subject}
                    </p>
                  )}
                  {[
                    "greeting",
                    "introduction",
                    "joining_statement",
                    "employee_identification",
                    "position_statement",
                    "employment_period",
                    "duration",
                    "verification_statement",
                    "responsibilities",
                    "closing",
                  ]
                    .map((key) => detail.content?.[key])
                    .filter(Boolean)
                    .map((paragraph, index) => (
                      <p key={index} className="leading-relaxed">
                        {paragraph}
                      </p>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-ink-100 pb-2">
      <span className="text-ink-500">{label}</span>
      <span className="font-medium text-ink-900">{value}</span>
    </div>
  );
}
