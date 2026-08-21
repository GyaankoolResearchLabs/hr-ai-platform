import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock3,
  X,
} from "lucide-react";

const STORAGE_KEY = "hr_exception_classifier_records";

const EMPTY_FORM = {
  title: "",
  employee: "",
  type: "Process Exception",
  severity: "Medium",
  description: "",
  action: "",
};

const EXCEPTION_TYPES = [
  "Process Exception",
  "Attendance Exception",
  "Leave Exception",
  "Payroll Exception",
  "Document Exception",
  "Compliance Exception",
  "Employee Data Exception",
  "Other",
];

const SEVERITIES = ["Low", "Medium", "High", "Critical"];

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatDate(date) {
  return new Date(date).toLocaleString();
}

function getSeverityClass(severity) {
  switch (severity) {
    case "Critical":
      return "bg-red-50 text-red-700 border-red-100";
    case "High":
      return "bg-orange-50 text-orange-700 border-orange-100";
    case "Medium":
      return "bg-amber-50 text-amber-700 border-amber-100";
    default:
      return "bg-slate-50 text-slate-600 border-slate-100";
  }
}

function getStatusClass(status) {
  switch (status) {
    case "Resolved":
      return "bg-emerald-50 text-emerald-700";
    case "Under Review":
      return "bg-blue-50 text-blue-700";
    default:
      return "bg-red-50 text-red-700";
  }
}

export default function HRExceptionClassifier() {
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [message, setMessage] = useState("");

  /* =========================================================
     LOAD SAVED RECORDS
  ========================================================= */

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          setRecords(parsed);
        }
      }
    } catch (error) {
      console.error(
        "Failed to load HR exception records:",
        error
      );
    }
  }, []);

  /* =========================================================
     SAVE RECORDS
  ========================================================= */

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(records)
      );
    } catch (error) {
      console.error(
        "Failed to save HR exception records:",
        error
      );
    }
  }, [records]);

  /* =========================================================
     FORM HANDLING
  ========================================================= */

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleCreate = (event) => {
    event.preventDefault();

    if (
      !form.title.trim() ||
      !form.employee.trim() ||
      !form.description.trim() ||
      !form.action.trim()
    ) {
      setMessage(
        "Please complete all required fields."
      );
      return;
    }

    const newRecord = {
      id: createId(),
      title: form.title.trim(),
      employee: form.employee.trim(),
      type: form.type,
      severity: form.severity,
      description: form.description.trim(),
      action: form.action.trim(),
      status: "Open",
      createdAt: new Date().toISOString(),
    };

    setRecords((previous) => [
      newRecord,
      ...previous,
    ]);

    setForm(EMPTY_FORM);
    setShowForm(false);
    setMessage("HR exception created successfully.");

    window.setTimeout(() => {
      setMessage("");
    }, 3000);
  };

  /* =========================================================
     STATUS ACTIONS
  ========================================================= */

  const updateStatus = (id, status) => {
    setRecords((previous) =>
      previous.map((record) => {
        if (record.id !== id) {
          return record;
        }

        return {
          ...record,
          status,
          updatedAt: new Date().toISOString(),
        };
      })
    );

    setMessage(
      status === "Resolved"
        ? "HR exception resolved successfully."
        : "HR exception moved to review."
    );

    window.setTimeout(() => {
      setMessage("");
    }, 3000);
  };

  /* =========================================================
     DELETE
  ========================================================= */

  const handleDelete = (id) => {
    const confirmed = window.confirm(
      "Delete this HR exception? This action cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    setRecords((previous) =>
      previous.filter((record) => record.id !== id)
    );

    setMessage("HR exception deleted successfully.");

    window.setTimeout(() => {
      setMessage("");
    }, 3000);
  };

  /* =========================================================
     FILTERING
  ========================================================= */

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return records.filter((record) => {
      const matchesSearch =
        !query ||
        record.title.toLowerCase().includes(query) ||
        record.employee.toLowerCase().includes(query) ||
        record.type.toLowerCase().includes(query) ||
        record.description.toLowerCase().includes(query);

      const matchesSeverity =
        filterSeverity === "All" ||
        record.severity === filterSeverity;

      const matchesStatus =
        filterStatus === "All" ||
        record.status === filterStatus;

      return (
        matchesSearch &&
        matchesSeverity &&
        matchesStatus
      );
    });
  }, [
    records,
    search,
    filterSeverity,
    filterStatus,
  ]);

  /* =========================================================
     STATISTICS
  ========================================================= */

  const totalExceptions = records.length;

  const openExceptions = records.filter(
    (record) => record.status === "Open"
  ).length;

  const underReviewExceptions = records.filter(
    (record) => record.status === "Under Review"
  ).length;

  const criticalExceptions = records.filter(
    (record) =>
      record.severity === "Critical" &&
      record.status !== "Resolved"
  ).length;

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="min-w-0 pb-10">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

        <div className="min-w-0">

          {/* TRUE BACK BUTTON */}
          <button
            type="button"
            onClick={() => window.history.back()}
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink-500 transition hover:text-ink-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex items-start gap-3">

            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <AlertTriangle
                className="h-5 w-5"
                strokeWidth={1.75}
              />
            </span>

            <div>
              <h1 className="font-display text-2xl font-semibold text-ink-950">
                HR Exception Classifier
              </h1>

              <p className="mt-1 text-sm text-ink-500">
                Classify HR exceptions by type, severity,
                and required review.
              </p>
            </div>

          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowForm(true);
            setMessage("");
          }}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          New exception
        </button>

      </div>

      {/* =====================================================
          SUCCESS / INFO MESSAGE
      ===================================================== */}

      {message && (
        <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      {/* =====================================================
          STATS
      ===================================================== */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
            Total exceptions
          </p>

          <p className="mt-2 text-2xl font-semibold text-ink-950">
            {totalExceptions}
          </p>
        </div>

        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
            Open
          </p>

          <p className="mt-2 text-2xl font-semibold text-ink-950">
            {openExceptions}
          </p>
        </div>

        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
            Under review
          </p>

          <p className="mt-2 text-2xl font-semibold text-ink-950">
            {underReviewExceptions}
          </p>
        </div>

        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
            Critical active
          </p>

          <p className="mt-2 text-2xl font-semibold text-ink-950">
            {criticalExceptions}
          </p>
        </div>

      </div>

      {/* =====================================================
          CREATE FORM
      ===================================================== */}

      {showForm && (
        <div className="card mb-6 overflow-hidden">

          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">

            <div>
              <h2 className="text-base font-semibold text-ink-900">
                Create HR exception
              </h2>

              <p className="mt-0.5 text-sm text-ink-500">
                Record the exception and define the
                required human review.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setForm(EMPTY_FORM);
              }}
              className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-50 hover:text-ink-700"
              aria-label="Close form"
            >
              <X className="h-5 w-5" />
            </button>

          </div>

          <form
            onSubmit={handleCreate}
            className="space-y-5 p-5"
          >

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

              {/* TITLE */}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-700">
                  Exception title
                </label>

                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="e.g. Missing resignation approval"
                  className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </div>

              {/* EMPLOYEE */}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-700">
                  Employee
                </label>

                <input
                  type="text"
                  name="employee"
                  value={form.employee}
                  onChange={handleChange}
                  placeholder="Employee name or ID"
                  className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </div>

              {/* TYPE */}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-700">
                  Exception type
                </label>

                <select
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                >
                  {EXCEPTION_TYPES.map((type) => (
                    <option
                      key={type}
                      value={type}
                    >
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* SEVERITY */}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-700">
                  Severity
                </label>

                <select
                  name="severity"
                  value={form.severity}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                >
                  {SEVERITIES.map((severity) => (
                    <option
                      key={severity}
                      value={severity}
                    >
                      {severity}
                    </option>
                  ))}
                </select>
              </div>

            </div>

            {/* DESCRIPTION */}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-700">
                Exception description
              </label>

              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={4}
                placeholder="Describe what happened and why it requires attention..."
                className="w-full resize-y rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            {/* ACTION */}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-700">
                Required action / review
              </label>

              <textarea
                name="action"
                value={form.action}
                onChange={handleChange}
                rows={3}
                placeholder="What should HR review or do next?"
                className="w-full resize-y rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            {/* FORM BUTTONS */}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">

              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setForm(EMPTY_FORM);
                }}
                className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                Create exception
              </button>

            </div>

          </form>
        </div>
      )}

      {/* =====================================================
          EXCEPTION LIST
      ===================================================== */}

      <div className="card overflow-hidden">

        {/* LIST HEADER */}

        <div className="border-b border-ink-100 px-5 py-5">

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

            <div>
              <h2 className="text-base font-semibold text-ink-900">
                HR exceptions
              </h2>

              <p className="mt-0.5 text-sm text-ink-500">
                Review unusual HR cases and their required
                actions.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">

              {/* SEARCH */}

              <div className="relative">

                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />

                <input
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search exceptions..."
                  className="w-full rounded-lg border border-ink-200 bg-white py-2 pl-9 pr-3 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:w-64"
                />

              </div>

              {/* SEVERITY FILTER */}

              <select
                value={filterSeverity}
                onChange={(event) =>
                  setFilterSeverity(event.target.value)
                }
                className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700 outline-none focus:border-brand-500"
              >
                <option value="All">
                  All severity
                </option>

                {SEVERITIES.map((severity) => (
                  <option
                    key={severity}
                    value={severity}
                  >
                    {severity}
                  </option>
                ))}
              </select>

              {/* STATUS FILTER */}

              <select
                value={filterStatus}
                onChange={(event) =>
                  setFilterStatus(event.target.value)
                }
                className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700 outline-none focus:border-brand-500"
              >
                <option value="All">
                  All status
                </option>

                <option value="Open">
                  Open
                </option>

                <option value="Under Review">
                  Under Review
                </option>

                <option value="Resolved">
                  Resolved
                </option>
              </select>

              {/* REFRESH */}

              <button
                type="button"
                onClick={() => {
                  try {
                    const saved =
                      localStorage.getItem(
                        STORAGE_KEY
                      );

                    setRecords(
                      saved
                        ? JSON.parse(saved)
                        : []
                    );
                  } catch (error) {
                    console.error(
                      "Failed to refresh records:",
                      error
                    );
                  }
                }}
                className="inline-flex items-center justify-center rounded-lg border border-ink-200 px-3 py-2 text-ink-600 transition hover:bg-ink-50"
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </button>

            </div>

          </div>

        </div>

        {/* EMPTY STATE */}

        {filteredRecords.length === 0 && (
          <div className="px-5 py-14 text-center">

            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </span>

            <h3 className="mt-4 text-sm font-semibold text-ink-900">
              {records.length === 0
                ? "No HR exceptions"
                : "No matching exceptions"}
            </h3>

            <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">
              {records.length === 0
                ? "Create an exception when an unusual HR case requires classification or human review."
                : "Try changing your search or filters."}
            </p>

          </div>
        )}

        {/* RECORDS */}

        {filteredRecords.length > 0 && (
          <div className="divide-y divide-ink-100">

            {filteredRecords.map((record) => (
              <div
                key={record.id}
                className="p-5"
              >

                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

                  {/* MAIN CONTENT */}

                  <div className="min-w-0 flex-1">

                    <div className="flex flex-wrap items-center gap-2">

                      <h3 className="text-sm font-semibold text-ink-950">
                        {record.title}
                      </h3>

                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getSeverityClass(
                          record.severity
                        )}`}
                      >
                        {record.severity}
                      </span>

                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusClass(
                          record.status
                        )}`}
                      >
                        {record.status}
                      </span>

                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-500">

                      <span>
                        Type:{" "}
                        <span className="font-medium text-ink-700">
                          {record.type}
                        </span>
                      </span>

                      <span>
                        Employee:{" "}
                        <span className="font-medium text-ink-700">
                          {record.employee}
                        </span>
                      </span>

                      <span>
                        Created:{" "}
                        {formatDate(record.createdAt)}
                      </span>

                    </div>

                    <div className="mt-4 rounded-lg bg-canvas px-3 py-3">

                      <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                        Exception
                      </p>

                      <p className="mt-1 text-sm leading-relaxed text-ink-700">
                        {record.description}
                      </p>

                    </div>

                    <div className="mt-3 rounded-lg border border-ink-100 px-3 py-3">

                      <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                        Required action
                      </p>

                      <p className="mt-1 text-sm leading-relaxed text-ink-700">
                        {record.action}
                      </p>

                    </div>

                  </div>

                  {/* ACTIONS */}

                  <div className="flex shrink-0 flex-wrap gap-2 lg:w-auto lg:flex-col">

                    {record.status === "Open" && (
                      <button
                        type="button"
                        onClick={() =>
                          updateStatus(
                            record.id,
                            "Under Review"
                          )
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-xs font-medium text-ink-700 transition hover:bg-ink-50"
                      >
                        <Clock3 className="h-4 w-4" />
                        Review
                      </button>
                    )}

                    {record.status !== "Resolved" && (
                      <button
                        type="button"
                        onClick={() =>
                          updateStatus(
                            record.id,
                            "Resolved"
                          )
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-brand-700"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Resolve
                      </button>
                    )}

                    {record.status === "Resolved" && (
                      <button
                        type="button"
                        onClick={() =>
                          updateStatus(
                            record.id,
                            "Under Review"
                          )
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-xs font-medium text-ink-700 transition hover:bg-ink-50"
                      >
                        Reopen
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        handleDelete(record.id)
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>

                  </div>

                </div>

              </div>
            ))}

          </div>
        )}

      </div>

      {/* =====================================================
          INFORMATION CARD
      ===================================================== */}

      <div className="card mt-6 p-5">

        <div className="flex items-start gap-3">

          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <AlertTriangle
              className="h-4 w-4"
              strokeWidth={1.75}
            />
          </span>

          <div>

            <h2 className="text-sm font-semibold text-ink-900">
              How exception classification works
            </h2>

            <p className="mt-1 text-sm leading-relaxed text-ink-500">
              HR teams can record unusual cases, classify
              their type and severity, define the required
              action, and move each case through human review
              until it is resolved.
            </p>

          </div>

        </div>

      </div>

    </div>
  );
}