import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  Check,
  CheckCircle2,
  FileCheck2,
  FileSearch,
  RefreshCw,
  Search,
  ShieldAlert,
  TriangleAlert,
  User,
  X,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import {
  employeeService,
} from "../../services/employeeService";

import {
  documentService,
} from "../../services/documentService";

/* =========================================================
   DOCUMENT TYPES
========================================================= */

const DOCUMENT_TYPES = [
  {
    value: "all",
    label: "All document types",
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
    label:
      "Employment Verification",
  },
  {
    value: "address_proof",
    label: "Address Proof",
  },
];

/* =========================================================
   VERIFIED FIELDS
========================================================= */

const VERIFICATION_FIELDS = [
  {
    key: "full_name",
    label: "Employee Name",
  },
  {
    key: "employee_code",
    label: "Employee Code",
  },
  {
    key: "email",
    label: "Email",
  },
  {
    key: "department",
    label: "Department",
  },
  {
    key: "title",
    label: "Job Title",
  },
  {
    key: "joining_date",
    label: "Joining Date",
  },
  {
    key: "employment_status",
    label: "Employment Status",
  },
  {
    key: "last_working_date",
    label:
      "Last Working Date",
  },
  {
    key: "address",
    label: "Address",
  },
];

/* =========================================================
   HELPERS
========================================================= */

function normalizeValue(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeDate(
  value
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return normalizeValue(
      value
    );
  }

  return date
    .toISOString()
    .slice(0, 10);
}

function formatDate(
  value
) {
  if (!value) {
    return "Not available";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function formatDocumentType(
  value
) {
  const match =
    DOCUMENT_TYPES.find(
      (type) =>
        type.value === value
    );

  return (
    match?.label ||
    value ||
    "HR Document"
  );
}

/* =========================================================
   EXTRACT DOCUMENT EMPLOYEE
========================================================= */

function getDocumentEmployee(
  document
) {
  const data =
    document?.document_data ||
    document?.document ||
    {};

  const employee =
    data?.employee ||
    {};

  return {
    full_name:
      employee.full_name ||
      employee.name ||
      data?.employee_name ||
      "",

    employee_code:
      employee.employee_code ||
      employee.employeeCode ||
      data?.employee_code ||
      "",

    email:
      employee.email ||
      data?.employee_email ||
      "",

    department:
      employee.department ||
      data?.department ||
      "",

    title:
      employee.title ||
      employee.job_title ||
      data?.job_title ||
      "",

    joining_date:
      employee.joining_date ||
      data?.joining_date ||
      "",

    employment_status:
      employee.employment_status ||
      data?.employment_status ||
      "",

    last_working_date:
      employee.last_working_date ||
      data?.last_working_date ||
      "",

    address:
      employee.address ||
      employee.employee_address ||
      data?.address ||
      data?.employee_address ||
      "",
  };
}

/* =========================================================
   GET EMPLOYEE FIELD
========================================================= */

function getEmployeeField(
  employee,
  key
) {
  switch (key) {
    case "full_name":
      return (
        employee?.full_name ||
        ""
      );

    case "employee_code":
      return (
        employee?.employee_code ||
        ""
      );

    case "email":
      return (
        employee?.email ||
        ""
      );

    case "department":
      return (
        employee?.department ||
        ""
      );

    case "title":
      return (
        employee?.title ||
        ""
      );

    case "joining_date":
      return (
        employee?.joining_date ||
        ""
      );

    case "employment_status":
      return (
        employee?.employment_status ||
        "Active"
      );

    case "last_working_date":
      return (
        employee?.last_working_date ||
        ""
      );

    case "address":
      return (
        employee?.address ||
        ""
      );

    default:
      return "";
  }
}

/* =========================================================
   COMPARE FIELD
========================================================= */

function compareField(
  field,
  employee,
  documentEmployee
) {
  const current =
    getEmployeeField(
      employee,
      field.key
    );

  const documentValue =
    documentEmployee?.[
      field.key
    ] || "";

  const currentNormalized =
    field.key.includes("date")
      ? normalizeDate(current)
      : normalizeValue(
          current
        );

  const documentNormalized =
    field.key.includes("date")
      ? normalizeDate(
          documentValue
        )
      : normalizeValue(
          documentValue
        );

  if (
    !documentNormalized &&
    !currentNormalized
  ) {
    return {
      ...field,
      status: "not_available",
      current,
      documentValue,
      message:
        "This field is not available in either record.",
    };
  }

  if (
    !documentNormalized
  ) {
    return {
      ...field,
      status: "missing",
      current,
      documentValue,
      message:
        "The document does not contain this employee information.",
    };
  }

  if (
    !currentNormalized
  ) {
    return {
      ...field,
      status: "warning",
      current,
      documentValue,
      message:
        "The employee record does not currently contain this information.",
    };
  }

  if (
    currentNormalized ===
    documentNormalized
  ) {
    return {
      ...field,
      status: "matched",
      current,
      documentValue,
      message:
        "Document value matches the current employee record.",
    };
  }

  return {
    ...field,
    status: "mismatch",
    current,
    documentValue,
    message:
      "The document value differs from the current employee record.",
  };
}

/* =========================================================
   COMPONENT
========================================================= */

export default function DocumentVerificationAssistant() {
  const navigate =
    useNavigate();

  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    documents,
    setDocuments,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    verifying,
    setVerifying,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    selectedEmployeeId,
    setSelectedEmployeeId,
  ] = useState("");

  const [
    selectedDocumentType,
    setSelectedDocumentType,
  ] = useState("all");

  const [
    selectedDocument,
    setSelectedDocument,
  ] = useState(null);

  const [
    results,
    setResults,
  ] = useState([]);

  /* =========================================================
     LOAD DATA
  ========================================================= */

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [
        employeeData,
        documentData,
      ] = await Promise.all([
        employeeService.list(),
        documentService.getGeneratedDocuments(),
      ]);

      setEmployees(
        Array.isArray(
          employeeData
        )
          ? employeeData
          : []
      );

      setDocuments(
        Array.isArray(
          documentData
        )
          ? documentData
          : []
      );
    } catch (err) {
      console.error(
        "Document verification load error:",
        err
      );

      setError(
        err?.response?.data
          ?.message ||
          err?.message ||
          "Could not load employee and document data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  /* =========================================================
     EMPLOYEE MAP
  ========================================================= */

  const employeeMap =
    useMemo(() => {
      const map =
        new Map();

      employees.forEach(
        (employee) => {
          if (employee?.id) {
            map.set(
              String(
                employee.id
              ),
              employee
            );
          }
        }
      );

      return map;
    }, [employees]);

  /* =========================================================
     FILTER DOCUMENTS
  ========================================================= */

  const filteredDocuments =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return documents.filter(
        (document) => {
          const employeeId =
            String(
              document?.employee_id ||
                ""
            );

          const employee =
            employeeMap.get(
              employeeId
            );

          const employeeName =
            employee?.full_name ||
            document
              ?.document_data
              ?.employee
              ?.full_name ||
            "";

          const type =
            document?.document_type ||
            "";

          const matchesSearch =
            !query ||
            employeeName
              .toLowerCase()
              .includes(query) ||
            formatDocumentType(
              type
            )
              .toLowerCase()
              .includes(query);

          const matchesEmployee =
            !selectedEmployeeId ||
            employeeId ===
              String(
                selectedEmployeeId
              );

          const matchesType =
            selectedDocumentType ===
              "all" ||
            type ===
              selectedDocumentType;

          return (
            matchesSearch &&
            matchesEmployee &&
            matchesType
          );
        }
      );
    }, [
      documents,
      employeeMap,
      search,
      selectedEmployeeId,
      selectedDocumentType,
    ]);

  /* =========================================================
     VERIFY DOCUMENT
  ========================================================= */

  function handleVerify(
    document
  ) {
    if (!document) {
      return;
    }

    setVerifying(true);
    setError("");

    try {
      const employeeId =
        String(
          document?.employee_id ||
            ""
        );

      const employee =
        employeeMap.get(
          employeeId
        );

      if (!employee) {
        setResults([
          {
            key: "employee",
            label:
              "Employee Record",
            status: "mismatch",
            current:
              "Employee record not found",
            documentValue:
              employeeId ||
              "No employee ID",
            message:
              "The saved document references an employee record that could not be found.",
          },
        ]);

        setSelectedDocument(
          document
        );

        return;
      }

      const documentEmployee =
        getDocumentEmployee(
          document
        );

      const comparisonResults =
        VERIFICATION_FIELDS.map(
          (field) =>
            compareField(
              field,
              employee,
              documentEmployee
            )
        );

      setResults(
        comparisonResults
      );

      setSelectedDocument(
        document
      );
    } finally {
      setVerifying(false);
    }
  }

  /* =========================================================
     SUMMARY
  ========================================================= */

  const matchedCount =
    results.filter(
      (item) =>
        item.status ===
        "matched"
    ).length;

  const mismatchCount =
    results.filter(
      (item) =>
        item.status ===
        "mismatch"
    ).length;

  const warningCount =
    results.filter(
      (item) =>
        item.status ===
          "warning" ||
        item.status ===
          "missing"
    ).length;

  const isVerified =
    results.length > 0 &&
    mismatchCount === 0 &&
    warningCount === 0;

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="min-w-0">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="mb-6">
        <button
          type="button"
          onClick={() =>
            navigate(-1)
          }
          className="mb-5 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <ArrowLeft
            size={16}
          />
          Back
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <FileSearch
                size={16}
              />
              Documents & HR
              Workflows
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              Document Verification
              Assistant
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Compare saved HR documents
              with current employee records
              and surface inconsistencies for
              human review.
            </p>
          </div>

          <button
            type="button"
            onClick={
              loadData
            }
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw
              size={15}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />
            Refresh
          </button>
        </div>
      </div>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="mb-5 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="flex items-center gap-2">
            <TriangleAlert
              size={17}
            />
            {error}
          </div>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* =====================================================
          HOW IT WORKS
      ===================================================== */}

      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
            <ShieldAlert
              size={18}
            />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              What is being checked?
            </h2>

            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              The assistant compares information
              stored in HR documents against the
              employee's current master record. It
              checks identity, employment details,
              dates, department, job title, status,
              and address information.
            </p>
          </div>
        </div>
      </div>

      {/* =====================================================
          FILTERS
      ===================================================== */}

      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* SEARCH */}

          <div>
            <label className="mb-2 block text-xs font-medium text-slate-500">
              Search documents
            </label>

            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target
                      .value
                  )
                }
                placeholder="Search employee or document..."
                className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </div>
          </div>

          {/* EMPLOYEE */}

          <div>
            <label className="mb-2 block text-xs font-medium text-slate-500">
              Employee
            </label>

            <select
              value={
                selectedEmployeeId
              }
              onChange={(
                event
              ) =>
                setSelectedEmployeeId(
                  event.target
                    .value
                )
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            >
              <option value="">
                All employees
              </option>

              {employees.map(
                (employee) => (
                  <option
                    key={
                      employee.id
                    }
                    value={
                      employee.id
                    }
                  >
                    {
                      employee.full_name
                    }
                  </option>
                )
              )}
            </select>
          </div>

          {/* DOCUMENT TYPE */}

          <div>
            <label className="mb-2 block text-xs font-medium text-slate-500">
              Document type
            </label>

            <select
              value={
                selectedDocumentType
              }
              onChange={(
                event
              ) =>
                setSelectedDocumentType(
                  event.target
                    .value
                )
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            >
              {DOCUMENT_TYPES.map(
                (type) => (
                  <option
                    key={
                      type.value
                    }
                    value={
                      type.value
                    }
                  >
                    {type.label}
                  </option>
                )
              )}
            </select>
          </div>
        </div>
      </div>

      {/* =====================================================
          SUMMARY CARDS
      ===================================================== */}

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={
            <FileCheck2
              size={18}
            />
          }
          value={
            documents.length
          }
          label="Documents Analyzed"
        />

        <SummaryCard
          icon={
            <CheckCircle2
              size={18}
            />
          }
          value={
            matchedCount
          }
          label="Fields Matched"
        />

        <SummaryCard
          icon={
            <TriangleAlert
              size={18}
            />
          }
          value={
            warningCount
          }
          label="Warnings"
        />

        <SummaryCard
          icon={
            <ShieldAlert
              size={18}
            />
          }
          value={
            mismatchCount
          }
          label="Critical Mismatches"
        />
      </div>

      {/* =====================================================
          DOCUMENT LIST
      ===================================================== */}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-base font-semibold text-slate-900">
            HR Documents
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Select a saved document to compare
            it against the employee's current
            record.
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-[260px] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <RefreshCw
                size={17}
                className="animate-spin"
              />
              Loading documents...
            </div>
          </div>
        ) : filteredDocuments.length ===
          0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400">
              <FileSearch
                size={22}
              />
            </div>

            <h3 className="text-sm font-semibold text-slate-900">
              No saved documents found
            </h3>

            <p className="mt-1 max-w-md text-sm text-slate-500">
              Generate and save an HR document
              using the Document & Letter
              Generator before running verification.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Employee
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Document
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Source
                  </th>

                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredDocuments.map(
                  (document) => {
                    const employee =
                      employeeMap.get(
                        String(
                          document?.employee_id ||
                            ""
                        )
                      );

                    return (
                      <tr
                        key={
                          document.id
                        }
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                              <User
                                size={17}
                              />
                            </div>

                            <div>
                              <p className="text-sm font-medium text-slate-900">
                                {employee?.full_name ||
                                  document
                                    ?.document_data
                                    ?.employee
                                    ?.full_name ||
                                  "Unknown Employee"}
                              </p>

                              <p className="mt-0.5 text-xs text-slate-500">
                                {employee?.department ||
                                  "Department not available"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-slate-800">
                            {formatDocumentType(
                              document?.document_type
                            )}
                          </p>

                          <p className="mt-0.5 text-xs text-slate-500">
                            {document?.title ||
                              "HR Document"}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                            {document?.source ===
                            "organization_template"
                              ? "Organization Template"
                              : "System"}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              handleVerify(
                                document
                              )
                            }
                            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-xs font-medium text-white transition hover:bg-teal-800"
                          >
                            <FileSearch
                              size={14}
                            />
                            Verify
                          </button>
                        </td>
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
          VERIFICATION MODAL
      ===================================================== */}

      {selectedDocument && (
        <VerificationModal
          document={
            selectedDocument
          }
          results={results}
          verified={
            isVerified
          }
          onClose={() => {
            setSelectedDocument(
              null
            );
            setResults([]);
          }}
        />
      )}
    </div>
  );
}

/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  icon,
  value,
  label,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-teal-700">
          {icon}
        </div>

        <span className="text-2xl font-semibold text-slate-950">
          {value}
        </span>
      </div>

      <p className="mt-4 text-sm text-slate-500">
        {label}
      </p>
    </div>
  );
}

/* =========================================================
   VERIFICATION MODAL
========================================================= */

function VerificationModal({
  document,
  results,
  verified,
  onClose,
}) {
  const matched =
    results.filter(
      (item) =>
        item.status ===
        "matched"
    ).length;

  const issues =
    results.filter(
      (item) =>
        item.status ===
          "mismatch" ||
        item.status ===
          "warning" ||
        item.status ===
          "missing"
    ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* HEADER */}

        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Document Verification
            </p>

            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              {document?.title ||
                formatDocumentType(
                  document?.document_type
                )}
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Compare document information
              against the current employee record.
            </p>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* CONTENT */}

        <div className="overflow-y-auto p-6">
          {/* RESULT BANNER */}

          <div
            className={`mb-5 rounded-xl border p-4 ${
              verified
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  verified
                    ? "bg-white text-emerald-600"
                    : "bg-white text-amber-600"
                }`}
              >
                {verified ? (
                  <CheckCircle2
                    size={19}
                  />
                ) : (
                  <TriangleAlert
                    size={19}
                  />
                )}
              </div>

              <div>
                <p
                  className={`text-sm font-semibold ${
                    verified
                      ? "text-emerald-800"
                      : "text-amber-800"
                  }`}
                >
                  {verified
                    ? "Document information matches the employee record"
                    : "HR review recommended"}
                </p>

                <p
                  className={`mt-1 text-xs ${
                    verified
                      ? "text-emerald-700"
                      : "text-amber-700"
                  }`}
                >
                  {matched} field
                  {matched ===
                  1
                    ? ""
                    : "s"} matched
                  successfully
                  {issues > 0
                    ? ` and ${issues} ${
                        issues === 1
                          ? "issue"
                          : "issues"
                      } require attention.`
                    : "."}
                </p>
              </div>
            </div>
          </div>

          {/* FIELD COMPARISON */}

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900">
                Field-by-field comparison
              </h3>
            </div>

            <div className="divide-y divide-slate-100">
              {results.map(
                (result) => (
                  <ComparisonRow
                    key={
                      result.key
                    }
                    result={
                      result
                    }
                  />
                )
              )}
            </div>
          </div>

          {/* HR ACTION */}

          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert
                size={18}
                className="mt-0.5 shrink-0 text-amber-600"
              />

              <div>
                <p className="text-sm font-medium text-amber-800">
                  Human review required
                </p>

                <p className="mt-1 text-xs leading-relaxed text-amber-700">
                  A mismatch does not automatically
                  mean that the document is invalid.
                  Verify the source document and
                  employee record before making any
                  HR correction.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}

        <div className="flex justify-end border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={
              onClose
            }
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   COMPARISON ROW
========================================================= */

function ComparisonRow({
  result,
}) {
  const statusConfig = {
    matched: {
      label: "Match",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700",
      icon: (
        <Check
          size={13}
        />
      ),
    },

    mismatch: {
      label: "Mismatch",
      className:
        "border-red-200 bg-red-50 text-red-700",
      icon: (
        <ShieldAlert
          size={13}
        />
      ),
    },

    warning: {
      label: "Warning",
      className:
        "border-amber-200 bg-amber-50 text-amber-700",
      icon: (
        <TriangleAlert
          size={13}
        />
      ),
    },

    missing: {
      label: "Missing",
      className:
        "border-amber-200 bg-amber-50 text-amber-700",
      icon: (
        <TriangleAlert
          size={13}
        />
      ),
    },

    not_available: {
      label: "Not Available",
      className:
        "border-slate-200 bg-slate-50 text-slate-500",
      icon: null,
    },
  };

  const config =
    statusConfig[
      result.status
    ] ||
    statusConfig.not_available;

  const displayValue =
    (value) => {
      if (!value) {
        return "Not available";
      }

      if (
        result.key.includes(
          "date"
        )
      ) {
        return formatDate(
          value
        );
      }

      return value;
    };

  return (
    <div className="grid grid-cols-1 gap-4 px-5 py-4 lg:grid-cols-[180px_1fr_1fr_110px] lg:items-center">
      <div>
        <p className="text-sm font-medium text-slate-800">
          {result.label}
        </p>

        <p className="mt-1 text-xs text-slate-400">
          {result.message}
        </p>
      </div>

      <div className="rounded-lg bg-slate-50 px-3 py-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Current employee record
        </p>

        <p className="mt-1 break-words text-sm text-slate-700">
          {displayValue(
            result.current
          )}
        </p>
      </div>

      <div className="rounded-lg bg-slate-50 px-3 py-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Document value
        </p>

        <p className="mt-1 break-words text-sm text-slate-700">
          {displayValue(
            result.documentValue
          )}
        </p>
      </div>

      <div>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${config.className}`}
        >
          {config.icon}
          {config.label}
        </span>
      </div>
    </div>
  );
}