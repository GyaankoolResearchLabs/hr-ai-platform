import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import {
  ArrowLeft,
  FileWarning,
  Users,
  AlertTriangle,
  CheckCircle2,
  Search,
  RefreshCw,
  FileText,
  Plus,
  X,
  Loader2,
  ChevronDown,
  Upload,
  Image as ImageIcon,
} from "lucide-react";
import employeeService from "../../services/employeeService";
import documentService from "../../services/documentService";

/* =========================================================
   REQUIRED DOCUMENTS

   For now these are the organization-wide requirements.
   Later we can move these into organization settings.
========================================================= */

const REQUIRED_DOCUMENTS = [
  {
    type: "aadhaar",
    label: "Aadhaar",
    critical: true,
  },
  {
    type: "pan",
    label: "PAN",
    critical: true,
  },
  {
    type: "offer_letter",
    label: "Offer Letter",
    critical: true,
  },
  {
    type: "address_proof",
    label: "Address Proof",
    critical: false,
  },
  {
    type: "bank_proof",
    label: "Bank Proof",
    critical: false,
  },
];

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

function normalizeStatus(status) {
  return String(status || "")
    .trim()
    .toLowerCase();
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

function getPriority(missingDocuments) {
  if (!missingDocuments.length) {
    return "Complete";
  }

  const criticalMissing =
    missingDocuments.filter(
      (document) => document.critical
    ).length;

  if (
    criticalMissing >= 2 ||
    missingDocuments.length >= 4
  ) {
    return "High";
  }

  if (
    criticalMissing >= 1 ||
    missingDocuments.length >= 2
  ) {
    return "Medium";
  }

  return "Low";
}

function isDocumentUsable(document) {
  const verificationStatus =
    normalizeStatus(
      document?.verification_status
    );

  /*
   * A document exists once HR has added it.
   *
   * Pending means the document still needs
   * human verification, but it is no longer
   * "missing".
   *
   * Rejected and expired documents should
   * continue to be treated as unusable.
   */
  return (
    verificationStatus === "pending" ||
    verificationStatus === "verified"
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function MissingDocumentDetector() {
  const navigate = useNavigate();

  const [employees, setEmployees] =
    useState([]);

  const [documents, setDocuments] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [scanning, setScanning] =
    useState(false);

  const [error, setError] =
    useState("");

  const [hasScanned, setHasScanned] =
    useState(false);

  const [searchTerm, setSearchTerm] =
    useState("");

  const [priorityFilter, setPriorityFilter] =
    useState("all");

  const [showAddDocument, setShowAddDocument] =
    useState(false);

  const [selectedEmployee, setSelectedEmployee] =
    useState(null);

  const [savingDocument, setSavingDocument] =
    useState(false);

const [documentForm, setDocumentForm] =
  useState({
    documentType: "aadhaar",
    documentNumber: "",
    expiryDate: "",
    notes: "",
    photo: null,
  });

  /* =========================================================
     LOAD DATA
  ========================================================= */

  const loadData = useCallback(
    async ({
      showScanner = false,
    } = {}) => {
      try {
        setError("");

        if (showScanner) {
          setScanning(true);
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

        if (showScanner) {
          setHasScanned(true);
        }
      } catch (err) {
        console.error(
          "Missing document detector load error:",
          err
        );

        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Could not load employee document data."
        );
      } finally {
        setLoading(false);
        setScanning(false);
      }
    },
    []
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* =========================================================
     SCAN EMPLOYEES
  ========================================================= */

  const scanResults = useMemo(() => {
    return employees.map((employee) => {
      const employeeId =
        getEmployeeId(employee);

      const employeeDocuments =
        documents.filter(
          (document) =>
            String(document.employee_id) ===
            String(employeeId)
        );

      const activeDocumentTypes =
        new Set(
          employeeDocuments
            .filter(isDocumentUsable)
            .map(
              (document) =>
                document.document_type
            )
        );

      const missingDocuments =
        REQUIRED_DOCUMENTS.filter(
          (requiredDocument) =>
            !activeDocumentTypes.has(
              requiredDocument.type
            )
        );

      const availableDocuments =
        REQUIRED_DOCUMENTS.filter(
          (requiredDocument) =>
            activeDocumentTypes.has(
              requiredDocument.type
            )
        );

      const priority =
        getPriority(missingDocuments);

      return {
        employee,
        employeeId,
        employeeDocuments,
        missingDocuments,
        availableDocuments,
        priority,
        complete:
          missingDocuments.length === 0,
      };
    });
  }, [employees, documents]);

  /* =========================================================
     SUMMARY
  ========================================================= */

  const summary = useMemo(() => {
    const employeesChecked =
      scanResults.length;

    const missingDocuments =
      scanResults.reduce(
        (total, result) =>
          total +
          result.missingDocuments.length,
        0
      );

    const highPriority =
      scanResults.filter(
        (result) =>
          result.priority === "High"
      ).length;

    const completeRecords =
      scanResults.filter(
        (result) => result.complete
      ).length;

    const employeesWithMissingDocuments =
      scanResults.filter(
        (result) => !result.complete
      ).length;

    return {
      employeesChecked,
      missingDocuments,
      highPriority,
      completeRecords,
      employeesWithMissingDocuments,
    };
  }, [scanResults]);

  /* =========================================================
     FILTER RESULTS
  ========================================================= */

  const filteredResults = useMemo(() => {
    const query = searchTerm
      .trim()
      .toLowerCase();

    return scanResults
      .filter(
        (result) => !result.complete
      )
      .filter((result) => {
        if (
          priorityFilter !== "all" &&
          result.priority.toLowerCase() !==
            priorityFilter
        ) {
          return false;
        }

        if (!query) {
          return true;
        }

        const employeeName =
          getEmployeeName(
            result.employee
          ).toLowerCase();

        const email =
          getEmployeeEmail(
            result.employee
          ).toLowerCase();

        const department =
          getEmployeeDepartment(
            result.employee
          ).toLowerCase();

        const missing =
          result.missingDocuments
            .map((document) =>
              document.label.toLowerCase()
            )
            .join(" ");

        return (
          employeeName.includes(query) ||
          email.includes(query) ||
          department.includes(query) ||
          missing.includes(query)
        );
      });
  }, [
    scanResults,
    searchTerm,
    priorityFilter,
  ]);

  /* =========================================================
     OPEN ADD DOCUMENT
  ========================================================= */

  function openAddDocument(
    employee,
    suggestedDocument = null
  ) {
    setSelectedEmployee(employee);

    setDocumentForm({
      documentType:
        suggestedDocument?.type || "aadhaar",
      documentNumber: "",
      expiryDate: "",
      notes: "",
      photo: null,
    });

    setShowAddDocument(true);
  }

  /* =========================================================
     CLOSE ADD DOCUMENT
  ========================================================= */

  function closeAddDocument() {
    if (savingDocument) {
      return;
    }

    setShowAddDocument(false);
    setSelectedEmployee(null);

    setDocumentForm({
      documentType: "aadhaar",
      documentNumber: "",
      expiryDate: "",
      notes: "",
      photo: null,
    });
  }

  /* =========================================================
     SAVE DOCUMENT
  ========================================================= */

  async function handleSaveDocument(event) {
    event.preventDefault();

    const employeeId =
      getEmployeeId(selectedEmployee);

    if (!employeeId) {
      setError(
        "Could not determine the selected employee ID."
      );
      return;
    }

    if (!documentForm.documentNumber.trim()) {
      setError(
        `${getDocumentLabel(
          documentForm.documentType
        )} number is required.`
      );
      return;
    }

    try {
      setSavingDocument(true);
      setError("");

      await documentService.createEmployeeDocument({
        employeeId,
        documentType:
          documentForm.documentType,
        documentNumber:
          documentForm.documentNumber.trim(),
        expiryDate:
          documentForm.expiryDate || null,
        notes:
          documentForm.notes.trim() || null,
        photo:
          documentForm.photo || null,
      });

      closeAddDocument();

      await loadData({
        showScanner: true,
      });
    } catch (err) {
      console.error(
        "Create employee document error:",
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not save employee document."
      );
    } finally {
      setSavingDocument(false);
    }
  }

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-brand-700" />

          <p className="mt-3 text-sm text-ink-500">
            Loading employee document
            records...
          </p>
        </div>
      </div>
    );
  }

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="min-h-full min-w-0">
      {/* =====================================================
          HEADER
      ===================================================== */}

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
            <FileWarning className="h-4 w-4" />

            Documents & HR Workflows
          </div>

          <h1 className="mt-2 text-2xl font-semibold text-ink-950">
            Missing Document Detector
          </h1>

          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            Compare employee document
            records against your required HR
            documentation checklist and
            identify records that need human
            follow-up.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            loadData({
              showScanner: true,
            })
          }
          disabled={scanning}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {scanning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}

          {scanning
            ? "Scanning..."
            : "Scan Records"}
        </button>
      </div>

      {/* =====================================================
          ERROR
      ===================================================== */}

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

      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={Users}
          value={
            summary.employeesChecked
          }
          label="Employees Checked"
        />

        <SummaryCard
          icon={FileWarning}
          value={
            summary.missingDocuments
          }
          label="Missing Documents"
        />

        <SummaryCard
          icon={AlertTriangle}
          value={
            summary.highPriority
          }
          label="High Priority"
        />

        <SummaryCard
          icon={CheckCircle2}
          value={
            summary.completeRecords
          }
          label="Complete Records"
        />
      </div>

      {/* =====================================================
          REQUIRED DOCUMENTS
      ===================================================== */}

      <div className="mb-6 rounded-xl border border-ink-100 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <FileWarning className="h-5 w-5" />
            </span>

            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink-900">
                Required document checklist
              </h2>

              <p className="mt-1 text-sm leading-relaxed text-ink-500">
                Every employee is currently
                checked against these required
                documents.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {REQUIRED_DOCUMENTS.map(
              (document) => (
                <span
                  key={document.type}
                  className="rounded-full border border-ink-200 bg-ink-50 px-3 py-1.5 text-xs font-medium text-ink-700"
                >
                  {document.label}
                </span>
              )
            )}
          </div>
        </div>
      </div>

      {/* =====================================================
          RESULTS
      ===================================================== */}

      <div className="min-w-0 overflow-hidden rounded-xl border border-ink-100 bg-white">
        <div className="border-b border-ink-100 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink-900">
                Missing Documents
              </h2>

              <p className="mt-1 text-sm text-ink-500">
                {
                  summary.employeesWithMissingDocuments
                }{" "}
                employee
                {summary.employeesWithMissingDocuments ===
                1
                  ? ""
                  : "s"}{" "}
                currently require document
                follow-up.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
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
                  placeholder="Search employee..."
                  className="w-full rounded-lg border border-ink-200 bg-white py-2 pl-9 pr-3 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-brand-400 sm:w-64"
                />
              </div>

              <div className="relative">
                <select
                  value={priorityFilter}
                  onChange={(event) =>
                    setPriorityFilter(
                      event.target.value
                    )
                  }
                  className="appearance-none rounded-lg border border-ink-200 bg-white py-2 pl-3 pr-9 text-sm text-ink-700 outline-none transition focus:border-brand-400"
                >
                  <option value="all">
                    All priorities
                  </option>

                  <option value="high">
                    High
                  </option>

                  <option value="medium">
                    Medium
                  </option>

                  <option value="low">
                    Low
                  </option>
                </select>

                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              </div>

              <button
                type="button"
                onClick={() =>
                  loadData({
                    showScanner: true,
                  })
                }
                disabled={scanning}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50 disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    scanning
                      ? "animate-spin"
                      : ""
                  }`}
                />

                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* ===================================================
            EMPTY RESULTS
        =================================================== */}

        {filteredResults.length === 0 ? (
          <div className="flex min-h-[300px] items-center justify-center px-5 py-12">
            <div className="text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <CheckCircle2 className="h-6 w-6" />
              </span>

              <h3 className="mt-4 text-sm font-semibold text-ink-900">
                {searchTerm ||
                priorityFilter !== "all"
                  ? "No matching records"
                  : "No missing documents detected"}
              </h3>

              <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">
                {searchTerm ||
                priorityFilter !== "all"
                  ? "Try changing your search or priority filter."
                  : employees.length === 0
                    ? "There are no employees available to scan yet."
                    : "All employees currently have the required document records."}
              </p>
            </div>
          </div>
        ) : (
          /* =================================================
             RESULTS TABLE
          ================================================= */

          <div className="w-full overflow-x-auto">
            <table className="min-w-[1000px] w-full">
              <thead className="bg-ink-50">
                <tr>
                  <TableHeading>
                    Employee
                  </TableHeading>

                  <TableHeading>
                    Department
                  </TableHeading>

                  <TableHeading>
                    Missing Documents
                  </TableHeading>

                  <TableHeading>
                    Progress
                  </TableHeading>

                  <TableHeading>
                    Priority
                  </TableHeading>

                  <TableHeading align="right">
                    Action
                  </TableHeading>
                </tr>
              </thead>

              <tbody className="divide-y divide-ink-100">
                {filteredResults.map(
                  (result) => {
                    const employeeName =
                      getEmployeeName(
                        result.employee
                      );

                    const completed =
                      result.availableDocuments
                        .length;

                    const total =
                      REQUIRED_DOCUMENTS.length;

                    return (
                      <tr
                        key={
                          result.employeeId ||
                          employeeName
                        }
                        className="align-top transition hover:bg-ink-50/60"
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium text-ink-900">
                              {employeeName}
                            </p>

                            <p className="mt-1 text-xs text-ink-500">
                              {getEmployeeEmail(
                                result.employee
                              )}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell>
                          {getEmployeeDepartment(
                            result.employee
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="flex max-w-md flex-wrap gap-2">
                            {result.missingDocuments.map(
                              (
                                document
                              ) => (
                                <button
                                  key={
                                    document.type
                                  }
                                  type="button"
                                  onClick={() =>
                                    openAddDocument(
                                      result.employee,
                                      document
                                    )
                                  }
                                  title={`Add ${document.label}`}
                                  className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 transition hover:bg-red-100"
                                >
                                  <Plus className="h-3 w-3" />

                                  {
                                    document.label
                                  }
                                </button>
                              )
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="min-w-32">
                            <div className="flex items-center justify-between gap-3 text-xs">
                              <span className="text-ink-600">
                                {completed}/
                                {total}
                              </span>

                              <span className="text-ink-400">
                                {Math.round(
                                  (completed /
                                    total) *
                                    100
                                )}
                                %
                              </span>
                            </div>

                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100">
                              <div
                                className="h-full rounded-full bg-brand-600"
                                style={{
                                  width: `${Math.round(
                                    (completed /
                                      total) *
                                      100
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <PriorityBadge
                            priority={
                              result.priority
                            }
                          />
                        </TableCell>

                        <TableCell align="right">
                          <button
                            type="button"
                            onClick={() =>
                              openAddDocument(
                                result.employee,
                                result
                                  .missingDocuments[0]
                              )
                            }
                            className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
                          >
                            <FileText className="h-4 w-4" />

                            Review
                          </button>
                        </TableCell>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =====================================================
          HR NOTICE
      ===================================================== */}

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

          <div>
            <h3 className="text-sm font-semibold text-amber-900">
              HR review required
            </h3>

            <p className="mt-1 text-sm leading-relaxed text-amber-800">
              This detector compares stored
              document records against the
              required checklist. A missing
              record does not automatically
              prove that an employee failed to
              provide a document. HR should
              verify the employee record before
              taking action.
            </p>
          </div>
        </div>
      </div>

      {/* =====================================================
          ADD DOCUMENT MODAL
      ===================================================== */}

      {showAddDocument &&
      selectedEmployee ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-xl">

            <div className="flex items-start justify-between border-b border-ink-100 p-5">
              <div>
                <h2 className="text-lg font-semibold text-ink-950">
                  Add Employee Document
                </h2>

                <p className="mt-1 text-sm text-ink-500">
                  {getEmployeeName(selectedEmployee)}
                </p>
              </div>

              <button
                type="button"
                onClick={closeAddDocument}
                disabled={savingDocument}
                className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveDocument}
              className="space-y-5 p-5"
            >

              {/* DOCUMENT TYPE */}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-800">
                  Document Type
                </label>

                <select
                  value={documentForm.documentType}
                  onChange={(event) =>
                    setDocumentForm((current) => ({
                      ...current,
                      documentType:
                        event.target.value,
                      documentNumber: "",
                      photo: null,
                    }))
                  }
                  className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-400"
                >
                  {DOCUMENT_OPTIONS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* DOCUMENT NUMBER */}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-800">
                  {getDocumentLabel(
                    documentForm.documentType
                  )} Number
                </label>

                <input
                  type="text"
                  value={documentForm.documentNumber}
                  onChange={(event) =>
                    setDocumentForm((current) => ({
                      ...current,
                      documentNumber:
                        event.target.value,
                    }))
                  }
                  placeholder={
                    documentForm.documentType ===
                    "aadhaar"
                      ? "Enter Aadhaar number"
                      : documentForm.documentType ===
                          "pan"
                        ? "Enter PAN number"
                        : documentForm.documentType ===
                            "passport"
                          ? "Enter passport number"
                          : "Enter document number"
                  }
                  className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-brand-400"
                />

                <p className="mt-1 text-xs text-ink-400">
                  Enter the identifier shown on the employee document.
                </p>
              </div>

              {/* DOCUMENT PHOTO */}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-800">
                  Document Photo
                  <span className="ml-1 font-normal text-ink-400">
                    optional
                  </span>
                </label>

                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink-200 bg-ink-50/40 px-5 py-7 text-center transition hover:border-brand-300 hover:bg-brand-50/30">

                  {documentForm.photo ? (
                    <div className="w-full">
                      <div className="mb-3 flex items-center justify-center gap-2 text-sm font-medium text-brand-700">
                        <ImageIcon className="h-4 w-4" />
                        {documentForm.photo.name}
                      </div>

                      <p className="text-xs text-ink-500">
                        Click to replace the selected photo
                      </p>
                    </div>
                  ) : (
                    <>
                      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-brand-700 shadow-sm">
                        <Upload className="h-5 w-5" />
                      </span>

                      <p className="text-sm font-medium text-ink-800">
                        Upload document photo
                      </p>

                      <p className="mt-1 text-xs text-ink-500">
                        JPG, PNG or WEBP up to 5 MB
                      </p>
                    </>
                  )}

                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file =
                        event.target.files?.[0] || null;

                      if (!file) {
                        return;
                      }

                      if (file.size > 5 * 1024 * 1024) {
                        setError(
                          "Document photo must be smaller than 5 MB."
                        );
                        return;
                      }

                      setError("");

                      setDocumentForm((current) => ({
                        ...current,
                        photo: file,
                      }));
                    }}
                  />
                </label>

                <p className="mt-1.5 text-xs text-ink-400">
                  Upload a clear photo or scan for HR verification.
                </p>
              </div>

              {/* EXPIRY DATE */}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-800">
                  Expiry Date
                  <span className="ml-1 font-normal text-ink-400">
                    optional
                  </span>
                </label>

                <input
                  type="date"
                  value={documentForm.expiryDate}
                  onChange={(event) =>
                    setDocumentForm((current) => ({
                      ...current,
                      expiryDate:
                        event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-400"
                />
              </div>

              {/* HR NOTES */}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-800">
                  HR Notes
                  <span className="ml-1 font-normal text-ink-400">
                    optional
                  </span>
                </label>

                <textarea
                  rows={3}
                  value={documentForm.notes}
                  onChange={(event) =>
                    setDocumentForm((current) => ({
                      ...current,
                      notes:
                        event.target.value,
                    }))
                  }
                  placeholder="Add verification notes or follow-up information..."
                  className="w-full resize-none rounded-lg border border-ink-200 px-3 py-2.5 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-brand-400"
                />
              </div>

              {/* VERIFICATION NOTICE */}

              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                <div className="flex gap-2">
                  <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />

                  <div>
                    <p className="text-xs font-semibold text-blue-900">
                      Document verification
                    </p>

                    <p className="mt-1 text-xs leading-relaxed text-blue-800">
                      The document number and photo give HR useful
                      information for verification. Saving this record
                      does not automatically prove that the document
                      is authentic.
                    </p>
                  </div>
                </div>
              </div>

              {/* ACTIONS */}

              <div className="flex justify-end gap-3 border-t border-ink-100 pt-5">

                <button
                  type="button"
                  onClick={closeAddDocument}
                  disabled={savingDocument}
                  className="rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-700 transition hover:bg-ink-50 disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    savingDocument ||
                    !documentForm.documentNumber.trim()
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingDocument ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}

                  {savingDocument
                    ? "Saving..."
                    : "Add Document"}
                </button>

              </div>

            </form>
          </div>
        </div>
      ) : null}

      {/* SCAN STATUS */}

      {hasScanned ? (
        <p className="mt-4 text-right text-xs text-ink-400">
          Records were refreshed using the
          latest employee and document data.
        </p>
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
   PRIORITY BADGE
========================================================= */

function PriorityBadge({
  priority,
}) {
  const classes = {
    High:
      "border-red-200 bg-red-50 text-red-700",

    Medium:
      "border-amber-200 bg-amber-50 text-amber-700",

    Low:
      "border-blue-200 bg-blue-50 text-blue-700",

    Complete:
      "border-green-200 bg-green-50 text-green-700",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
        classes[priority] ||
        classes.Low
      }`}
    >
      {priority}
    </span>
  );
}