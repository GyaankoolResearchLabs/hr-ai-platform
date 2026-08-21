import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import {
  ArrowLeft,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  Search,
  RefreshCw,
  FileText,
  Clock3,
  XCircle,
  Loader2,
  ChevronDown,
  ExternalLink,
  X,
  Save,
  ShieldCheck,
  RotateCcw,
  Trash2,
  AlertOctagon,
} from "lucide-react";

import employeeService from "../../services/employeeService";
import documentService from "../../services/documentService";

/* =========================================================
   DOCUMENT TYPES
========================================================= */

const DOCUMENT_OPTIONS = [
  {
    value: "aadhaar",
    label: "Aadhaar",
  },
  {
    value: "pan",
    label: "PAN",
  },
  {
    value: "passport",
    label: "Passport",
  },
  {
    value: "bank_proof",
    label: "Bank Proof",
  },
  {
    value: "address_proof",
    label: "Address Proof",
  },
  {
    value: "offer_letter",
    label: "Offer Letter",
  },
  {
    value: "experience_letter",
    label: "Experience Letter",
  },
  {
    value: "employment_verification",
    label: "Employment Verification",
  },
  {
    value: "education_certificate",
    label: "Education Certificate",
  },
  {
    value: "experience_certificate",
    label: "Experience Certificate",
  },
  {
    value: "joining_document",
    label: "Joining Document",
  },
  {
    value: "other",
    label: "Other",
  },
];

/* =========================================================
   HELPERS
========================================================= */

function getEmployeeId(employee) {
  return (
    employee?.id ||
    employee?._id ||
    employee?.employee_id ||
    null
  );
}

function getEmployeeName(employee) {
  return (
    employee?.full_name ||
    employee?.name ||
    employee?.employee_name ||
    "Unnamed employee"
  );
}

function getEmployeeEmail(employee) {
  return employee?.email || "—";
}

function getEmployeeDepartment(employee) {
  return (
    employee?.department ||
    employee?.department_name ||
    "Not assigned"
  );
}
function getEmploymentStatus(employee) {
  return (
    employee?.employment_status ||
    "Active"
  );
}

function getLastWorkingDate(employee) {
  return (
    employee?.last_working_date ||
    null
  );
}

function isEmployeeInactive(employee) {
  const status =
    getEmploymentStatus(employee);

  return status !== "Active";
}

function formatEmploymentStatus(status) {
  if (!status) {
    return "Active";
  }

  return String(status);
}
function getDocumentLabel(type) {
  return (
    DOCUMENT_OPTIONS.find(
      (item) => item.value === type
    )?.label ||
    String(type || "")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      )
  );
}

/* =========================================================
   DATE HELPERS
========================================================= */

function parseDateOnly(value) {
  if (!value) {
    return null;
  }

  const stringValue = String(value).slice(0, 10);

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      stringValue
    );

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(
    year,
    month - 1,
    day
  );

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function startOfToday() {
  const today = new Date();

  return new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
}

function getDaysDifference(expiryDate) {
  const expiry = parseDateOnly(
    expiryDate
  );

  if (!expiry) {
    return null;
  }

  const today = startOfToday();

  const millisecondsPerDay =
    24 * 60 * 60 * 1000;

  return Math.round(
    (expiry.getTime() - today.getTime()) /
      millisecondsPerDay
  );
}

function formatExpiryDate(value) {
  const date = parseDateOnly(value);

  if (!date) {
    return "No expiry date";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

function addOneYearToDate(value) {
  const date = parseDateOnly(value);

  if (!date) {
    return "";
  }

  const year = date.getFullYear() + 1;
  const month = date.getMonth();
  const day = date.getDate();

  // Keep leap-day renewals valid.
  if (month === 1 && day === 29) {
    const nextYearIsLeap =
      new Date(year, 1, 29).getMonth() === 1;

    if (!nextYearIsLeap) {
      return `${year}-02-28`;
    }
  }

  return [
    year,
    String(month + 1).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

/* =========================================================
   EXPIRY CLASSIFICATION
========================================================= */

function getExpiryStatus(expiryDate) {
  const daysRemaining =
    getDaysDifference(expiryDate);

  if (daysRemaining === null) {
    return {
      key: "no-expiry",
      label: "No Expiry",
      description:
        "No expiry date is recorded",
    };
  }

  if (daysRemaining < 0) {
    return {
      key: "expired",
      label: "Expired",
      description: `${Math.abs(
        daysRemaining
      )} day${
        Math.abs(daysRemaining) === 1
          ? ""
          : "s"
      } overdue`,
    };
  }

  if (daysRemaining <= 7) {
    return {
      key: "seven-days",
      label: "Expiring Soon",
      description:
        daysRemaining === 0
          ? "Expires today"
          : `${daysRemaining} day${
              daysRemaining === 1
                ? ""
                : "s"
            } remaining`,
    };
  }

  if (daysRemaining <= 30) {
    return {
      key: "thirty-days",
      label: "Expiring in 30 Days",
      description: `${daysRemaining} days remaining`,
    };
  }

  if (daysRemaining <= 90) {
    return {
      key: "ninety-days",
      label: "Expiring in 90 Days",
      description: `${daysRemaining} days remaining`,
    };
  }

  return {
    key: "valid",
    label: "Valid",
    description: `${daysRemaining} days remaining`,
  };
}

/* =========================================================
   PAGE
========================================================= */

export default function DocumentExpiryMonitor() {
  const navigate = useNavigate();

  const [employees, setEmployees] =
    useState([]);

  const [documents, setDocuments] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [searchTerm, setSearchTerm] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  /* =======================================================
     REVIEW MODAL
  ======================================================= */

  const [selectedRecord, setSelectedRecord] =
    useState(null);

  const [reviewDocument, setReviewDocument] =
    useState(null);

  const [reviewLoading, setReviewLoading] =
    useState(false);

  const [savingReview, setSavingReview] =
    useState(false);

  const [reviewError, setReviewError] =
    useState("");

const [reviewExpiryDate, setReviewExpiryDate] =
  useState("");

const [originalReviewExpiryDate, setOriginalReviewExpiryDate] =
  useState("");

const [reviewNotes, setReviewNotes] =
  useState("");

const [reviewVerificationStatus, setReviewVerificationStatus] =
  useState("pending");

const [reviewMode, setReviewMode] =
  useState("normal");

const [reverifyResult, setReverifyResult] =
  useState("");

const [reviewDocumentStatus, setReviewDocumentStatus] =
  useState("active");

const [documentViewUrl, setDocumentViewUrl] =
  useState("");

const [deletingDocument, setDeletingDocument] =
  useState(false);

  /* =======================================================
     LOAD DATA
  ======================================================= */

  const loadData = useCallback(
    async ({
      showRefresh = false,
    } = {}) => {
      try {
        setError("");

        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const [
          employeeRows,
          documentRows,
        ] = await Promise.all([
          employeeService.list(),
          documentService.getEmployeeDocuments(),
        ]);

        setEmployees(
          Array.isArray(employeeRows)
            ? employeeRows
            : []
        );

        setDocuments(
          Array.isArray(documentRows)
            ? documentRows
            : []
        );
      } catch (err) {
        console.error(
          "Document expiry monitor load error:",
          err
        );

        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Could not load employee document data."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* =======================================================
     EMPLOYEE LOOKUP
  ======================================================= */

  const employeeMap = useMemo(() => {
    const map = new Map();

    employees.forEach((employee) => {
      const employeeId =
        getEmployeeId(employee);

      if (employeeId) {
        map.set(
          String(employeeId),
          employee
        );
      }
    });

    return map;
  }, [employees]);

  /* =======================================================
     EXPIRY RECORDS
  ======================================================= */

  const expiryRecords = useMemo(() => {
    return documents
      .map((document) => {
        const employee =
          employeeMap.get(
            String(document.employee_id)
          );

        const expiry =
          getExpiryStatus(
            document.expiry_date
          );

        return {
          document,
          employee,

          documentId:
            document?.id ||
            document?._id ||
            null,

          employeeId:
            document.employee_id,

  employeeStatus:
    getEmploymentStatus(employee),

  lastWorkingDate:
    getLastWorkingDate(employee),

  employeeInactive:
    isEmployeeInactive(employee),

          employeeName:
            getEmployeeName(employee),

          employeeEmail:
            getEmployeeEmail(employee),

          department:
            getEmployeeDepartment(employee),

          documentType:
            document.document_type,

          documentLabel:
            getDocumentLabel(
              document.document_type
            ),

          expiryDate:
            document.expiry_date,

          formattedExpiryDate:
            formatExpiryDate(
              document.expiry_date
            ),

          daysRemaining:
            getDaysDifference(
              document.expiry_date
            ),

          statusKey:
            expiry.key,

          statusLabel:
            expiry.label,

          statusDescription:
            expiry.description,
        };
      })
      .sort((a, b) => {
        if (
          a.daysRemaining === null &&
          b.daysRemaining === null
        ) {
          return 0;
        }

        if (
          a.daysRemaining === null
        ) {
          return 1;
        }

        if (
          b.daysRemaining === null
        ) {
          return -1;
        }

        return (
          a.daysRemaining -
          b.daysRemaining
        );
      });
  }, [documents, employeeMap]);

  /* =======================================================
     SUMMARY
  ======================================================= */

  const summary = useMemo(() => {
    const totalDocuments =
      expiryRecords.length;

    const expired =
      expiryRecords.filter(
        (record) =>
          record.statusKey === "expired"
      ).length;

    const expiringSevenDays =
      expiryRecords.filter(
        (record) =>
          record.statusKey === "seven-days"
      ).length;

    const expiringThirtyDays =
      expiryRecords.filter(
        (record) =>
          record.statusKey ===
          "thirty-days"
      ).length;

    const expiringNinetyDays =
      expiryRecords.filter(
        (record) =>
          record.statusKey ===
          "ninety-days"
      ).length;

    const noExpiry =
      expiryRecords.filter(
        (record) =>
          record.statusKey === "no-expiry"
      ).length;

    const valid =
      expiryRecords.filter(
        (record) =>
          record.statusKey === "valid"
      ).length;

    const employeesWithExpiryIssues =
      new Set(
        expiryRecords
          .filter(
            (record) =>
              record.statusKey ===
                "expired" ||
              record.statusKey ===
                "seven-days" ||
              record.statusKey ===
                "thirty-days"
          )
          .map((record) =>
            String(record.employeeId)
          )
      ).size;

    return {
      totalDocuments,
      expired,
      expiringSevenDays,
      expiringThirtyDays,
      expiringNinetyDays,
      noExpiry,
      valid,
      employeesWithExpiryIssues,
    };
  }, [expiryRecords]);

  /* =======================================================
     FILTER
  ======================================================= */

  const filteredRecords = useMemo(() => {
    const query =
      searchTerm
        .trim()
        .toLowerCase();

    return expiryRecords.filter(
      (record) => {
        if (
          statusFilter !== "all" &&
          record.statusKey !==
            statusFilter
        ) {
          return false;
        }

        if (!query) {
          return true;
        }

        return (
          record.employeeName
            .toLowerCase()
            .includes(query) ||
          record.employeeEmail
            .toLowerCase()
            .includes(query) ||
          record.department
            .toLowerCase()
            .includes(query) ||
          record.documentLabel
            .toLowerCase()
            .includes(query)
        );
      }
    );
  }, [
    expiryRecords,
    searchTerm,
    statusFilter,
  ]);

  /* =======================================================
     OPEN REVIEW
  ======================================================= */

  async function openReview(record) {
    if (!record?.documentId) {
      setError(
        "This document does not have a valid document ID."
      );
      return;
    }

    setSelectedRecord(record);
    setReviewDocument(null);
    setReviewError("");
    setDocumentViewUrl("");
    setReviewExpiryDate(
      record.expiryDate
        ? String(
            record.expiryDate
          ).slice(0, 10)
        : ""
    );
    setOriginalReviewExpiryDate(
      record.expiryDate
        ? String(record.expiryDate).slice(0, 10)
        : ""
    );
    setReviewNotes(
      record.document?.notes || ""
    );
    setReviewVerificationStatus(
      record.document?.verification_status ||
        "pending"
    );
    setReviewMode("normal");
    setReverifyResult("");

setReviewDocumentStatus(
  record.document?.status ||
    "active"
);
    try {
      setReviewLoading(true);
       
      const document =
        await documentService.getEmployeeDocument(
          record.documentId
        );

      setReviewDocument(document);
      setReviewVerificationStatus(
        document?.verification_status ||
          "pending"
      );
      setReviewMode("normal");
      setReverifyResult("");

setReviewDocumentStatus(
  document?.status ||
    "active"
);
      setReviewExpiryDate(
        document?.expiry_date
          ? String(
              document.expiry_date
            ).slice(0, 10)
          : ""
      );

      setOriginalReviewExpiryDate(
        document?.expiry_date
          ? String(document.expiry_date).slice(0, 10)
          : ""
      );

      setReviewNotes(
        document?.notes || ""
      );
    } catch (err) {
      console.error(
        "Load employee document review error:",
        err
      );

      setReviewError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not load the document details."
      );
    } finally {
      setReviewLoading(false);
    }
  }

  /* =======================================================
     CLOSE REVIEW
  ======================================================= */

  function closeReview() {
    if (savingReview) {
      return;
    }

    setSelectedRecord(null);
    setReviewDocument(null);
    setReviewError("");
    setDocumentViewUrl("");
    setReviewExpiryDate("");
    setOriginalReviewExpiryDate("");
    setReviewNotes("");
    setReviewVerificationStatus("pending");
    setReviewMode("normal");
    setReverifyResult("");
    setReviewDocumentStatus("active");
    setDeletingDocument(false);
  }

  /* =======================================================
     VIEW DOCUMENT
  ======================================================= */

  async function handleViewDocument() {
    const documentId =
      selectedRecord?.documentId;

    if (!documentId) {
      return;
    }

    try {
      setReviewError("");

      const response =
        await documentService.getEmployeeDocumentView(
          documentId
        );

      const url =
        response?.url ||
        response?.signed_url ||
        response?.signedUrl ||
        response?.file_url ||
        response?.fileUrl;

      if (!url) {
        throw new Error(
          "The document view URL was not returned."
        );
      }

      setDocumentViewUrl(url);

      window.open(
        url,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (err) {
      console.error(
        "View employee document error:",
        err
      );

      setReviewError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not open the document."
      );
    }
  }

  /* =======================================================
     START RE-VERIFICATION
  ======================================================= */

  function handleStartReverify() {
    setReviewError("");
    setReverifyResult("");

    const baseExpiryDate =
      originalReviewExpiryDate ||
      reviewExpiryDate;

    const renewedExpiryDate =
      addOneYearToDate(baseExpiryDate);

    if (!renewedExpiryDate) {
      setReviewError(
        "A valid expiry date is required to re-verify this document."
      );
      return;
    }

    // Enter re-verification mode immediately and show the
    // one-year renewal date before HR confirms the result.
    setReviewExpiryDate(renewedExpiryDate);
    setReviewMode("reverify");
  }

  /* =======================================================
     CONFIRM RE-VERIFICATION
  ======================================================= */

  async function handleConfirmReverify() {
    const documentId =
      selectedRecord?.documentId;

    if (!documentId) {
      setReviewError(
        "Document ID is missing."
      );
      return;
    }

    if (!reverifyResult) {
      setReviewError(
        "Select Verified or Rejected before confirming the re-verification."
      );
      return;
    }

    try {
      setSavingReview(true);
      setReviewError("");
      setError("");

      const isVerified =
        reverifyResult === "verified";

      // Always calculate the renewal from the ORIGINAL
      // stored expiry date. Never calculate it from today's date
      // or from a value already changed in the UI.
      const renewedExpiryDate =
        addOneYearToDate(
          originalReviewExpiryDate
        );

      if (isVerified && !renewedExpiryDate) {
        throw new Error(
          "A valid existing expiry date is required to renew this document."
        );
      }

      const finalExpiryDate =
        isVerified
          ? renewedExpiryDate
          : originalReviewExpiryDate || null;

      const finalStatus = isVerified
        ? "active"
        : reviewDocumentStatus;

      await documentService.updateEmployeeDocument(
        documentId,
        {
          expiryDate: finalExpiryDate,
          verificationStatus:
            reverifyResult,
          status: finalStatus,
          notes:
            reviewNotes.trim() || null,
        }
      );

      // Immediately reflect the persisted result inside the modal.
      setReviewExpiryDate(
        finalExpiryDate || ""
      );

      setOriginalReviewExpiryDate(
        finalExpiryDate || ""
      );

      setReviewVerificationStatus(
        reverifyResult
      );

      setReviewDocumentStatus(
        finalStatus
      );

      setReviewMode("normal");
      setReverifyResult("");

      // Refresh the table so Expired/Valid is recalculated
      // from the newly persisted expiry date.
      await loadData({
        showRefresh: true,
      });
    } catch (err) {
      console.error(
        "Document re-verification error:",
        err
      );

      setReviewError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not complete document re-verification."
      );
    } finally {
      setSavingReview(false);
    }
  }

  /* =======================================================
     CANCEL RE-VERIFICATION
  ======================================================= */

  function handleCancelReverify() {
    if (savingReview) {
      return;
    }

    setReviewError("");
    setReverifyResult("");
    setReviewExpiryDate(
      originalReviewExpiryDate
    );
    setReviewMode("normal");
  }

  /* =======================================================
     SAVE REVIEW
  ======================================================= */

  async function handleSaveReview(event) {
    event.preventDefault();

    const documentId =
      selectedRecord?.documentId;

    if (!documentId) {
      setReviewError(
        "Document ID is missing."
      );
      return;
    }

    try {
      setSavingReview(true);
      setReviewError("");
      setError("");

    await documentService.updateEmployeeDocument(
  documentId,
  {
    expiryDate:
      reviewExpiryDate || null,

    notes:
      reviewNotes.trim() || null,

    verificationStatus:
      reviewVerificationStatus,

    status:
      reviewDocumentStatus,
  }
);
      closeReview();

      await loadData({
        showRefresh: true,
      });
    } catch (err) {
      console.error(
        "Update employee document error:",
        err
      );

      setReviewError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not update the document."
      );
    } finally {
      setSavingReview(false);
    }
  }

  /* =======================================================
     DELETE DOCUMENT
  ======================================================= */

  async function handleDeleteDocument() {
    const documentId =
      selectedRecord?.documentId;

    if (!documentId) {
      setReviewError(
        "Document ID is missing."
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedRecord?.documentLabel || "this document"} for ${selectedRecord?.employeeName || "this employee"} permanently?\n\nThis removes the document record and cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingDocument(true);
      setReviewError("");
      setError("");

      await documentService.deleteEmployeeDocument(
        documentId
      );

      closeReview();

      await loadData({
        showRefresh: true,
      });
    } catch (err) {
      console.error(
        "Delete employee document error:",
        err
      );

      setReviewError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not delete the document."
      );
    } finally {
      setDeletingDocument(false);
    }
  }

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-brand-700" />

          <p className="mt-3 text-sm text-ink-500">
            Loading document expiry records...
          </p>
        </div>
      </div>
    );
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="min-h-full min-w-0">

      {/* ===================================================
          HEADER
      =================================================== */}

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

        <div className="min-w-0">

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-4 inline-flex items-center gap-2 text-sm text-ink-500 transition hover:text-ink-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex items-center gap-2 text-sm text-brand-700">
            <CalendarClock className="h-4 w-4" />
            Documents & HR Workflows
          </div>

          <h1 className="mt-2 text-2xl font-semibold text-ink-950">
            Document Expiry Monitor
          </h1>

          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            Monitor employee document expiry
            dates and identify renewals that
            need HR attention before they
            become overdue.
          </p>

        </div>

        <button
          type="button"
          onClick={() =>
            loadData({
              showRefresh: true,
            })
          }
          disabled={refreshing}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}

          {refreshing
            ? "Refreshing..."
            : "Refresh Records"}
        </button>

      </div>

      {/* ===================================================
          ERROR
      =================================================== */}

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">

          <div className="flex gap-3">

            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

            <div>

              <p className="text-sm font-semibold text-red-900">
                Something needs attention
              </p>

              <p className="mt-1 text-sm text-red-700">
                {error}
              </p>

            </div>

          </div>

        </div>
      ) : null}

      {/* ===================================================
          SUMMARY
      =================================================== */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <SummaryCard
          icon={FileText}
          value={
            summary.totalDocuments
          }
          label="Documents Tracked"
        />

        <SummaryCard
          icon={XCircle}
          value={summary.expired}
          label="Expired"
        />

        <SummaryCard
          icon={Clock3}
          value={
            summary.expiringSevenDays
          }
          label="Expiring Within 7 Days"
        />

        <SummaryCard
          icon={AlertTriangle}
          value={
            summary.expiringThirtyDays
          }
          label="Expiring Within 30 Days"
        />

      </div>

      {/* ===================================================
          STATUS OVERVIEW
      =================================================== */}

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">

        <StatusOverviewCard
          icon={XCircle}
          label="Expired"
          value={summary.expired}
          description="Documents already past their expiry date."
          tone="red"
        />

        <StatusOverviewCard
          icon={Clock3}
          label="Expiring Soon"
          value={
            summary.expiringSevenDays
          }
          description="Documents requiring immediate HR attention."
          tone="amber"
        />

        <StatusOverviewCard
          icon={CheckCircle2}
          label="Valid"
          value={summary.valid}
          description="Documents currently outside the 90-day warning window."
          tone="green"
        />

      </div>

      {/* ===================================================
          RECORDS
      =================================================== */}

      <div className="min-w-0 overflow-hidden rounded-xl border border-ink-100 bg-white">

        <div className="border-b border-ink-100 p-5">

          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

            <div>

              <h2 className="text-base font-semibold text-ink-900">
                Document Expiry Records
              </h2>

              <p className="mt-1 text-sm text-ink-500">
                {summary.expired +
                  summary.expiringSevenDays +
                  summary.expiringThirtyDays}{" "}
                document
                {summary.expired +
                  summary.expiringSevenDays +
                  summary.expiringThirtyDays ===
                1
                  ? ""
                  : "s"}{" "}
                currently require
                attention within the
                active warning window.
              </p>

            </div>

            <div className="flex flex-col gap-3 sm:flex-row">

              {/* SEARCH */}

              <div className="relative">

                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />

                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) =>
                    setSearchTerm(
                      event.target.value
                    )
                  }
                  placeholder="Search employee or document..."
                  className="w-full rounded-lg border border-ink-200 bg-white py-2 pl-9 pr-3 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-brand-400 sm:w-72"
                />

              </div>

              {/* FILTER */}

              <div className="relative">

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value
                    )
                  }
                  className="appearance-none rounded-lg border border-ink-200 bg-white py-2 pl-3 pr-9 text-sm text-ink-700 outline-none transition focus:border-brand-400"
                >
                  <option value="all">
                    All statuses
                  </option>

                  <option value="expired">
                    Expired
                  </option>

                  <option value="seven-days">
                    Expiring ≤ 7 days
                  </option>

                  <option value="thirty-days">
                    Expiring ≤ 30 days
                  </option>

                  <option value="ninety-days">
                    Expiring ≤ 90 days
                  </option>

                  <option value="valid">
                    Valid
                  </option>

                  <option value="no-expiry">
                    No expiry date
                  </option>
                </select>

                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />

              </div>

            </div>

          </div>

        </div>

        {/* =================================================
            EMPTY STATE
        ================================================= */}

        {filteredRecords.length === 0 ? (

          <div className="flex min-h-[300px] items-center justify-center px-5 py-12">

            <div className="text-center">

              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <CheckCircle2 className="h-6 w-6" />
              </span>

              <h3 className="mt-4 text-sm font-semibold text-ink-900">
                {searchTerm ||
                statusFilter !== "all"
                  ? "No matching records"
                  : "No document records found"}
              </h3>

              <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">
                {searchTerm ||
                statusFilter !== "all"
                  ? "Try changing your search or expiry filter."
                  : employees.length === 0
                    ? "There are no employees available yet."
                    : "No employee documents are currently available to monitor."}
              </p>

            </div>

          </div>

        ) : (

          /* =================================================
             TABLE
          ================================================= */

          <div className="w-full overflow-x-auto">

            <table className="min-w-[1100px] w-full">

              <thead className="bg-ink-50">

                <tr>

                  <TableHeading>
                    Employee
                  </TableHeading>

                  <TableHeading>
                    Department
                  </TableHeading>

                  <TableHeading>
                    Document
                  </TableHeading>

                  <TableHeading>
                    Expiry Date
                  </TableHeading>

                  <TableHeading>
                    Time Remaining
                  </TableHeading>

                  <TableHeading>
                    Status
                  </TableHeading>

                  <TableHeading align="right">
                    Action
                  </TableHeading>

                </tr>

              </thead>

              <tbody className="divide-y divide-ink-100">

                {filteredRecords.map(
                  (record) => (
                    <tr
                      key={
                        record.documentId ||
                        `${record.employeeId}-${record.documentType}`
                      }
                      className="align-top transition hover:bg-ink-50/60"
                    >

                      <TableCell>

                        <div>

                          <p className="font-medium text-ink-900">
                            {record.employeeName}
                          </p>

                          <p className="mt-1 text-xs text-ink-500">
                            {record.employeeEmail}
                          </p>

                        </div>

                      </TableCell>

                      <TableCell>
                        {record.department}
                      </TableCell>

                      <TableCell>

                        <div className="flex items-center gap-2">

                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                            <FileText className="h-4 w-4" />
                          </span>

                          <div>

                            <p className="font-medium text-ink-900">
                              {record.documentLabel}
                            </p>

                            <p className="mt-1 text-xs text-ink-400">
                              {record.document.status ||
                                "Record available"}
                              {" · "}
                              {record.document.verification_status ===
                              "verified"
                                ? "Verified"
                                : record.document.verification_status ===
                                  "rejected"
                                  ? "Rejected"
                                  : "Verification pending"}
                            </p>

                          </div>

                        </div>

                      </TableCell>

                      <TableCell>

                        <span className="text-sm font-medium text-ink-800">
                          {
                            record.formattedExpiryDate
                          }
                        </span>

                      </TableCell>

                      <TableCell>

                        <p
                          className={`font-medium ${
                            record.statusKey ===
                            "expired"
                              ? "text-red-700"
                              : record.statusKey ===
                                "seven-days"
                                ? "text-amber-700"
                                : record.statusKey ===
                                  "thirty-days"
                                  ? "text-amber-700"
                                  : "text-ink-700"
                          }`}
                        >
                          {record.daysRemaining ===
                          null
                            ? "—"
                            : record.daysRemaining <
                              0
                              ? `${Math.abs(
                                  record.daysRemaining
                                )} day${
                                  Math.abs(
                                    record.daysRemaining
                                  ) === 1
                                    ? ""
                                    : "s"
                                } overdue`
                              : record.daysRemaining ===
                                0
                                ? "Expires today"
                                : `${record.daysRemaining} day${
                                    record.daysRemaining ===
                                    1
                                      ? ""
                                      : "s"
                                  } left`}
                        </p>

                      </TableCell>

                      <TableCell>

                        <ExpiryBadge
                          statusKey={
                            record.statusKey
                          }
                          label={
                            record.statusLabel
                          }
                        />

                      </TableCell>

                      <TableCell align="right">

                        <button
                          type="button"
                          onClick={() =>
                            openReview(record)
                          }
                          className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
                        >
                          <FileText className="h-4 w-4" />
                          Review
                        </button>

                      </TableCell>

                    </tr>
                  )
                )}

              </tbody>

            </table>

          </div>
        )}

      </div>

      {/* ===================================================
          MONITORING RULES
      =================================================== */}

      <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4">

        <div className="flex gap-3">

          <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />

          <div>

            <h3 className="text-sm font-semibold text-blue-900">
              Expiry monitoring rules
            </h3>

            <p className="mt-1 text-sm leading-relaxed text-blue-800">
              Documents are classified
              automatically from their stored
              expiry date. Expired documents are
              flagged first, followed by documents
              expiring within 7, 30, or 90 days.
              Documents without an expiry date
              are shown separately.
            </p>

          </div>

        </div>

      </div>

      {/* ===================================================
          HR NOTICE
      =================================================== */}

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">

        <div className="flex gap-3">

          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

          <div>

            <h3 className="text-sm font-semibold text-amber-900">
              HR review required
            </h3>

            <p className="mt-1 text-sm leading-relaxed text-amber-800">
              An expiry alert indicates that a
              stored document date requires
              attention. HR should verify the
              employee record and renewal status
              before taking action.
            </p>

          </div>

        </div>

      </div>

      {/* ===================================================
          DOCUMENT REVIEW MODAL
      =================================================== */}

      {selectedRecord ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">

            {/* MODAL HEADER */}

            <div className="flex items-start justify-between border-b border-ink-100 p-5">

              <div className="min-w-0">

                <div className="flex items-center gap-2 text-sm text-brand-700">

                  <FileText className="h-4 w-4" />

                  Document Review

                </div>

                <h2 className="mt-1 text-lg font-semibold text-ink-950">
                  {
                    selectedRecord.documentLabel
                  }
                </h2>

                <p className="mt-1 text-sm text-ink-500">
                  {selectedRecord.employeeName}
                  {" · "}
                  {selectedRecord.department}
                </p>

              </div>

              <button
                type="button"
                onClick={closeReview}
                disabled={savingReview}
                className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>

            </div>

            {/* MODAL BODY */}

            <div className="overflow-y-auto">

              {reviewError ? (
                <div className="mx-5 mt-5 rounded-xl border border-red-200 bg-red-50 p-4">

                  <div className="flex gap-3">

                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

                    <div>

                      <p className="text-sm font-semibold text-red-900">
                        Review could not be completed
                      </p>

                      <p className="mt-1 text-sm text-red-700">
                        {reviewError}
                      </p>

                    </div>

                  </div>

                </div>
              ) : null}

              {reviewLoading ? (

                <div className="flex min-h-[300px] items-center justify-center">

                  <div className="text-center">

                    <Loader2 className="mx-auto h-7 w-7 animate-spin text-brand-700" />

                    <p className="mt-3 text-sm text-ink-500">
                      Loading document details...
                    </p>

                  </div>

                </div>

              ) : (

                <form
                  onSubmit={handleSaveReview}
                  className="space-y-5 p-5"
                >

                  {/* EMPLOYEE INFORMATION */}

                  <div className="rounded-xl border border-ink-100 bg-ink-50/50 p-4">

                    <h3 className="text-sm font-semibold text-ink-900">
                      Employee
                    </h3>

                    <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">

                      <InfoField
                        label="Name"
                        value={
                          selectedRecord.employeeName
                        }
                      />

                      <InfoField
                        label="Department"
                        value={
                          selectedRecord.department
                        }
                      />

                      <InfoField
                        label="Email"
                        value={
                          selectedRecord.employeeEmail
                        }
                      />

                      <InfoField
                        label="Document"
                        value={
                          selectedRecord.documentLabel
                        }
                      />

                    </div>

                  </div>

                  {/* EMPLOYEE LIFECYCLE NOTICE */}

                  {selectedRecord.employeeInactive ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">

                      <div className="flex gap-3">

                        <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

                        <div className="min-w-0">

                          <h3 className="text-sm font-semibold text-amber-900">
                            Employee is no longer active
                          </h3>

                          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">

                            <InfoField
                              label="Employment Status"
                              value={formatEmploymentStatus(
                                selectedRecord.employeeStatus
                              )}
                            />

                            <InfoField
                              label="Last Working Date"
                              value={
                                selectedRecord.lastWorkingDate
                                  ? formatExpiryDate(
                                      selectedRecord.lastWorkingDate
                                    )
                                  : "Not recorded"
                              }
                            />

                          </div>

                          <p className="mt-3 text-xs leading-relaxed text-amber-800">
                            This employee is no longer active.
                            Review the document for retention,
                            archival, replacement, or deletion
                            according to your organization's policy.
                          </p>

                        </div>

                      </div>

                    </div>
                  ) : null}

                  {/* DOCUMENT STATUS */}

                  <div className="rounded-xl border border-ink-100 bg-white p-4">

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                      <div>

                        <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                          Current expiry status
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-2">

                          <ExpiryBadge
                            statusKey={
                              getExpiryStatus(
                                reviewExpiryDate
                              ).key
                            }
                            label={
                              getExpiryStatus(
                                reviewExpiryDate
                              ).label
                            }
                          />

                          <span className="text-sm text-ink-500">
                            {
                              getExpiryStatus(
                                reviewExpiryDate
                              ).description
                            }
                          </span>

                        </div>

                      </div>

                      {reviewDocument?.file_url ? (
                        <button
                          type="button"
                          onClick={
                            handleViewDocument
                          }
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
                        >
                          <ExternalLink className="h-4 w-4" />
                          View Document
                        </button>
                      ) : null}

                    </div>

                  </div>

                  {/* DOCUMENT VERIFICATION / RE-VERIFICATION */}

                  <div className="rounded-xl border border-ink-100 bg-white p-4">

                    {reviewMode === "normal" ? (
                      <div className="flex flex-col gap-4">

                        <div className="flex items-start justify-between gap-3">

                          <div>

                            <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                              Document verification
                            </p>

                            <p className="mt-1 text-sm text-ink-500">
                              This document has already gone through its initial verification.
                            </p>

                          </div>

                          <ShieldCheck className="h-5 w-5 shrink-0 text-brand-700" />

                        </div>

                        <div className="flex flex-col gap-3 rounded-lg bg-ink-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">

                          <div>

                            <p className="text-sm font-medium text-ink-800">
                              Verification status
                            </p>

                            <p className="mt-1 text-xs text-ink-500">
                              {reviewVerificationStatus === "verified"
                                ? "HR has verified this document."
                                : reviewVerificationStatus === "rejected"
                                  ? "HR has rejected this document."
                                  : "This document is awaiting verification."}
                            </p>

                          </div>

                          <span
                            className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${
                              reviewVerificationStatus === "verified"
                                ? "border-green-200 bg-green-50 text-green-700"
                                : reviewVerificationStatus === "rejected"
                                  ? "border-red-200 bg-red-50 text-red-700"
                                  : "border-amber-200 bg-amber-50 text-amber-700"
                            }`}
                          >
                            {reviewVerificationStatus === "verified"
                              ? "Verified"
                              : reviewVerificationStatus === "rejected"
                                ? "Rejected"
                                : "Pending"}
                          </span>

                        </div>

                        <button
                          type="button"
                          onClick={handleStartReverify}
                          disabled={savingReview}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-medium text-brand-700 transition hover:border-brand-300 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <RotateCcw className="h-4 w-4" />
                          Re-verify Document
                        </button>

                      </div>
                    ) : (
                      <div className="flex flex-col gap-4">

                        <div className="flex items-start justify-between gap-3">

                          <div>

                            <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
                              Document re-verification
                            </p>

                            <p className="mt-1 text-sm text-ink-500">
                              Review the current document and confirm its verification result here.
                            </p>

                          </div>

                          <ShieldCheck className="h-5 w-5 shrink-0 text-brand-700" />

                        </div>

                        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                          <p className="text-xs leading-relaxed text-blue-800">
                            You are re-verifying this existing document. You do not need to leave the Expiry Monitor.
                          </p>
                        </div>

                        {reviewDocument?.file_url ? (
                          <button
                            type="button"
                            onClick={handleViewDocument}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
                          >
                            <ExternalLink className="h-4 w-4" />
                            View Document Again
                          </button>
                        ) : null}

                        <div className="rounded-lg border border-green-100 bg-green-50 p-3">

                          <p className="text-xs font-medium uppercase tracking-wide text-green-700">
                            Renewed expiry date
                          </p>

                          <p className="mt-1 text-sm font-semibold text-green-900">
                            {formatExpiryDate(reviewExpiryDate)}
                          </p>

                          <p className="mt-1 text-xs leading-relaxed text-green-800">
                            Re-verification automatically extends the document expiry by one year from the previous expiry date.
                          </p>

                        </div>

                        <div>

                          <p className="mb-2 text-sm font-medium text-ink-800">
                            Verification result
                          </p>

                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">

                            <button
                              type="button"
                              onClick={() =>
                                setReverifyResult(
                                  "verified"
                                )
                              }
                              disabled={savingReview}
                              className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                reverifyResult === "verified"
                                  ? "border-green-300 bg-green-50 text-green-800"
                                  : "border-ink-200 bg-white text-ink-700 hover:border-green-300 hover:bg-green-50"
                              }`}
                            >
                              Verified
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setReverifyResult(
                                  "rejected"
                                )
                              }
                              disabled={savingReview}
                              className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                reverifyResult === "rejected"
                                  ? "border-red-300 bg-red-50 text-red-800"
                                  : "border-ink-200 bg-white text-ink-700 hover:border-red-300 hover:bg-red-50"
                              }`}
                            >
                              Rejected
                            </button>

                          </div>

                        </div>

                        <div>

                          <label className="mb-1.5 block text-sm font-medium text-ink-800">
                            Verification Notes
                          </label>

                          <textarea
                            rows={4}
                            value={reviewNotes}
                            onChange={(event) =>
                              setReviewNotes(
                                event.target.value
                              )
                            }
                            placeholder="Add notes about this re-verification..."
                            className="w-full resize-none rounded-lg border border-ink-200 px-3 py-2.5 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-brand-400"
                          />

                        </div>

                        <div className="flex flex-col-reverse gap-2 border-t border-ink-100 pt-4 sm:flex-row sm:justify-end">

                          <button
                            type="button"
                            onClick={handleCancelReverify}
                            disabled={savingReview}
                            className="rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-700 transition hover:bg-ink-50 disabled:opacity-60"
                          >
                            Cancel
                          </button>

                          <button
                            type="button"
                            onClick={handleConfirmReverify}
                            disabled={
                              savingReview ||
                              !reverifyResult
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {savingReview ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ShieldCheck className="h-4 w-4" />
                            )}

                            {savingReview
                              ? "Confirming..."
                              : "Confirm Verification"}
                          </button>

                        </div>

                      </div>
                    )}

                  </div>

                  {reviewMode === "normal" ? (
                    <>

                  {/* EXPIRY DATE */}

                  <div>

                    <label className="mb-1.5 block text-sm font-medium text-ink-800">
                      Expiry Date
                    </label>

                    <input
                      type="date"
                      value={
                        reviewExpiryDate
                      }
                      onChange={(event) =>
                        setReviewExpiryDate(
                          event.target.value
                        )
                      }
                      className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-400"
                    />

                    <p className="mt-1.5 text-xs text-ink-400">
                      Update this when HR confirms
                      the current document or
                      renewal.
                    </p>

                  </div>

                  {/* NOTES */}

                  <div>

                    <label className="mb-1.5 block text-sm font-medium text-ink-800">
                      HR Notes
                    </label>

                    <textarea
                      rows={4}
                      value={reviewNotes}
                      onChange={(event) =>
                        setReviewNotes(
                          event.target.value
                        )
                      }
                      placeholder="Add renewal or verification notes..."
                      className="w-full resize-none rounded-lg border border-ink-200 px-3 py-2.5 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-brand-400"
                    />

                  </div>

                  {/* DOCUMENT ACTIONS */}

                  <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-4">

                    <div className="flex items-start gap-3">

                      <FileText className="mt-0.5 h-5 w-5 shrink-0 text-ink-500" />

                      <div className="min-w-0 flex-1">

                        <h3 className="text-sm font-semibold text-ink-900">
                          Document actions
                        </h3>

                        <p className="mt-1 text-xs leading-relaxed text-ink-500">
                          Use these actions when the document
                          has been superseded or should no longer
                          remain in the employee record.
                        </p>

                        <div className="mt-4 flex flex-col gap-2 sm:flex-row">

                          <button
                            type="button"
                            onClick={() =>
                              setReviewDocumentStatus(
                                "replaced"
                              )
                            }
                            className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                              reviewDocumentStatus === "replaced"
                                ? "border-blue-300 bg-blue-50 text-blue-800"
                                : "border-ink-200 bg-white text-ink-700 hover:border-blue-300 hover:text-blue-700"
                            }`}
                          >
                            <RotateCcw className="h-4 w-4" />
                            Mark as Replaced
                          </button>

                        </div>

                        {reviewDocumentStatus ===
                        "replaced" ? (
                          <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-800">
                            This document will be marked as
                            replaced when you save. Upload the
                            employee's new document separately.
                          </p>
                        ) : null}

                      </div>

                    </div>

                  </div>

                  {/* REVIEW NOTICE */}

                  <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">

                    <div className="flex gap-2">

                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />

                      <p className="text-xs leading-relaxed text-amber-800">
                        Updating the expiry date
                        records the information
                        provided by HR. It does not
                        independently verify the
                        authenticity or renewal of
                        the document.
                      </p>

                    </div>

                  </div>

                  {/* ACTIONS */}

                  <div className="flex flex-col-reverse gap-3 border-t border-ink-100 pt-5 sm:flex-row sm:items-center sm:justify-end">

                    <button
                      type="button"
                      onClick={handleDeleteDocument}
                      disabled={
                        savingReview ||
                        deletingDocument
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 sm:mr-auto"
                    >
                      {deletingDocument ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}

                      {deletingDocument
                        ? "Deleting..."
                        : "Delete Document"}
                    </button>

                    <button
                      type="button"
                      onClick={closeReview}
                      disabled={
                        savingReview ||
                        deletingDocument
                      }
                      className="rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-700 transition hover:bg-ink-50 disabled:opacity-60"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={savingReview}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >

                      {savingReview ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}

                      {savingReview
                        ? "Saving..."
                        : "Save Changes"}

                    </button>

                  </div>


                    </>
                  ) : null}

                </form>

              )}

            </div>

          </div>

        </div>
      ) : null}

    </div>
  );
}

/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  icon: Icon,
  value,
  label,
}) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-5">

      <div className="flex items-start justify-between gap-3">

        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Icon className="h-5 w-5" />
        </span>

        <span className="text-2xl font-semibold text-ink-950">
          {value}
        </span>

      </div>

      <p className="mt-4 text-sm text-ink-500">
        {label}
      </p>

    </div>
  );
}

/* =========================================================
   STATUS OVERVIEW CARD
========================================================= */

function StatusOverviewCard({
  icon: Icon,
  label,
  value,
  description,
  tone,
}) {
  const toneClasses = {
    red: {
      wrapper:
        "border-red-100 bg-red-50/60",
      icon:
        "bg-red-100 text-red-700",
      value:
        "text-red-800",
    },

    amber: {
      wrapper:
        "border-amber-100 bg-amber-50/60",
      icon:
        "bg-amber-100 text-amber-700",
      value:
        "text-amber-800",
    },

    green: {
      wrapper:
        "border-green-100 bg-green-50/60",
      icon:
        "bg-green-100 text-green-700",
      value:
        "text-green-800",
    },
  };

  const classes =
    toneClasses[tone] ||
    toneClasses.green;

  return (
    <div
      className={`rounded-xl border p-4 ${classes.wrapper}`}
    >

      <div className="flex items-start justify-between gap-3">

        <span
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${classes.icon}`}
        >
          <Icon className="h-5 w-5" />
        </span>

        <span
          className={`text-2xl font-semibold ${classes.value}`}
        >
          {value}
        </span>

      </div>

      <p className="mt-4 text-sm font-semibold text-ink-900">
        {label}
      </p>

      <p className="mt-1 text-xs leading-relaxed text-ink-500">
        {description}
      </p>

    </div>
  );
}

/* =========================================================
   INFO FIELD
========================================================= */

function InfoField({
  label,
  value,
}) {
  return (
    <div>

      <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium text-ink-800">
        {value || "—"}
      </p>

    </div>
  );
}

/* =========================================================
   TABLE HELPERS
========================================================= */

function TableHeading({
  children,
  align = "left",
}) {
  return (
    <th
      className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-500 ${
        align === "right"
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function TableCell({
  children,
  align = "left",
}) {
  return (
    <td
      className={`px-5 py-4 text-sm text-ink-700 ${
        align === "right"
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </td>
  );
}

/* =========================================================
   EXPIRY BADGE
========================================================= */

function ExpiryBadge({
  statusKey,
  label,
}) {
  const classes = {
    expired:
      "border-red-200 bg-red-50 text-red-700",

    "seven-days":
      "border-amber-200 bg-amber-50 text-amber-700",

    "thirty-days":
      "border-amber-200 bg-amber-50 text-amber-700",

    "ninety-days":
      "border-blue-200 bg-blue-50 text-blue-700",

    valid:
      "border-green-200 bg-green-50 text-green-700",

    "no-expiry":
      "border-ink-200 bg-ink-50 text-ink-600",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
        classes[statusKey] ||
        classes["no-expiry"]
      }`}
    >
      {label}
    </span>
  );
}