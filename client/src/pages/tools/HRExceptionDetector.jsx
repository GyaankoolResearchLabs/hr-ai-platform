import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  AlertTriangle,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock3,
  UserRound,
} from "lucide-react";
import api from "../../lib/api";

export default function HRExceptionDetector() {
  const navigate = useNavigate();

  const [exceptions, setExceptions] = useState([]);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  /*
   * ---------------------------------------------------------
   * LOAD EXCEPTIONS
   * ---------------------------------------------------------
   */

  const loadExceptions = async (isRefresh = false) => {
    try {
      setError("");

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      /*
       * Use the existing HR requests API.
       * The detector analyses requests that may require
       * human attention.
       */
      const response = await api.get("/hr-requests");

      const data = response?.data;

      const requests = Array.isArray(data)
        ? data
        : Array.isArray(data?.requests)
        ? data.requests
        : [];

      /*
       * Convert HR requests into exception records.
       *
       * This keeps the tool useful even before a dedicated
       * exception-detection backend is introduced.
       */
      const detectedExceptions = requests
        .map((request) => {
          const status = String(
            request.status || "pending"
          ).toLowerCase();

          const priority = String(
            request.priority || "normal"
          ).toLowerCase();

          const title =
            request.title ||
            request.subject ||
            request.request_title ||
            "HR Request";

          const description =
            request.description ||
            request.details ||
            request.message ||
            "";

          let severity = "medium";
          let reason = "Requires human review.";

          if (
            priority === "urgent" ||
            priority === "critical"
          ) {
            severity = "high";
            reason =
              "Urgent HR request requires human attention.";
          } else if (
            status === "rejected" ||
            status === "cancelled"
          ) {
            severity = "high";
            reason =
              "Request has an exception status and requires review.";
          } else if (
            status === "pending" ||
            status === "open"
          ) {
            severity = "medium";
            reason =
              "Request is still awaiting action.";
          } else if (
            !description.trim()
          ) {
            severity = "medium";
            reason =
              "Request is missing supporting details.";
          }

          return {
            id:
              request.id ||
              request.request_id,

            title,

            description,

            category:
              request.category ||
              request.request_category ||
              "General HR",

            priority,

            status,

            owner:
              request.owner_name ||
              request.owner ||
              request.assigned_to_name ||
              request.assigned_to ||
              "Unassigned",

            severity,

            reason,

            createdAt:
              request.created_at ||
              request.createdAt ||
              request.created ||
              null,

            dueAt:
              request.due_at ||
              request.dueAt ||
              request.deadline ||
              null,
          };
        })
        /*
         * Only display records that actually have something
         * requiring attention.
         */
        .filter((item) => {
          return (
            item.severity === "high" ||
            item.severity === "medium"
          );
        });

      setExceptions(detectedExceptions);
    } catch (err) {
      console.error(
        "Failed to load HR exceptions:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Unable to load HR exceptions."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadExceptions();
  }, []);

  /*
   * ---------------------------------------------------------
   * FILTER
   * ---------------------------------------------------------
   */

  const filteredExceptions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return exceptions.filter((item) => {
      const matchesSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.owner.toLowerCase().includes(query) ||
        item.reason.toLowerCase().includes(query);

      const matchesSeverity =
        severityFilter === "all" ||
        item.severity === severityFilter;

      const matchesStatus =
        statusFilter === "all" ||
        item.status === statusFilter;

      return (
        matchesSearch &&
        matchesSeverity &&
        matchesStatus
      );
    });
  }, [
    exceptions,
    search,
    severityFilter,
    statusFilter,
  ]);

  /*
   * ---------------------------------------------------------
   * COUNTS
   * ---------------------------------------------------------
   */

  const highSeverityCount = exceptions.filter(
    (item) => item.severity === "high"
  ).length;

  const mediumSeverityCount = exceptions.filter(
    (item) => item.severity === "medium"
  ).length;

  const unresolvedCount = exceptions.filter(
    (item) =>
      item.status !== "resolved" &&
      item.status !== "completed" &&
      item.status !== "closed"
  ).length;

  /*
   * ---------------------------------------------------------
   * HELPERS
   * ---------------------------------------------------------
   */

  const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleString();
  };

  const statusLabel = (status) => {
    return String(status)
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  };

  const severityLabel = (severity) => {
    return severity === "high"
      ? "High"
      : "Medium";
  };

  const severityClass = (severity) => {
    if (severity === "high") {
      return "bg-red-50 text-red-700";
    }

    return "bg-amber-50 text-amber-700";
  };

  const statusClass = (status) => {
    if (
      status === "resolved" ||
      status === "completed" ||
      status === "closed"
    ) {
      return "bg-emerald-50 text-emerald-700";
    }

    return "bg-amber-50 text-amber-700";
  };

  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */

  return (
    <div className="min-w-0">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="mb-6">
        {/* Browser-style back navigation.
            This returns to the previous page, NOT Dashboard. */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink-500 transition hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <AlertTriangle
                className="h-5 w-5"
                strokeWidth={1.75}
              />
            </span>

            <div>
              <h1 className="font-display text-2xl font-semibold text-ink-950">
                HR Exception Detector
              </h1>

              <p className="mt-1 text-sm text-ink-500">
                Surface HR cases that require human
                attention.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadExceptions(true)}
            disabled={refreshing}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                refreshing ? "animate-spin" : ""
              }`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
            Exceptions detected
          </p>

          <p className="mt-2 text-2xl font-semibold text-ink-950">
            {exceptions.length}
          </p>
        </div>

        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
            High severity
          </p>

          <p className="mt-2 text-2xl font-semibold text-red-600">
            {highSeverityCount}
          </p>
        </div>

        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
            Requiring attention
          </p>

          <p className="mt-2 text-2xl font-semibold text-amber-600">
            {unresolvedCount}
          </p>
        </div>
      </div>

      {/* =====================================================
          EXCEPTIONS
      ===================================================== */}

      <div className="card overflow-hidden">
        <div className="border-b border-ink-100 px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink-900">
                Detected HR exceptions
              </h2>

              <p className="mt-0.5 text-sm text-ink-500">
                Unusual or incomplete HR cases that may
                require human review.
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
                  className="w-full rounded-lg border border-ink-200 bg-white py-2 pl-9 pr-3 text-sm text-ink-800 outline-none placeholder:text-ink-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:w-64"
                />
              </div>

              {/* SEVERITY */}

              <select
                value={severityFilter}
                onChange={(event) =>
                  setSeverityFilter(
                    event.target.value
                  )
                }
                className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              >
                <option value="all">
                  All severity
                </option>
                <option value="high">
                  High
                </option>
                <option value="medium">
                  Medium
                </option>
              </select>

              {/* STATUS */}

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
                className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              >
                <option value="all">
                  All statuses
                </option>
                <option value="pending">
                  Pending
                </option>
                <option value="open">
                  Open
                </option>
                <option value="in_progress">
                  In progress
                </option>
                <option value="resolved">
                  Resolved
                </option>
              </select>
            </div>
          </div>
        </div>

        {/* =================================================
            LOADING
        ================================================= */}

        {loading ? (
          <div className="flex min-h-[250px] items-center justify-center">
            <div className="text-center">
              <RefreshCw className="mx-auto h-6 w-6 animate-spin text-brand-600" />

              <p className="mt-3 text-sm text-ink-500">
                Analysing HR records...
              </p>
            </div>
          </div>
        ) : filteredExceptions.length === 0 ? (
          /* =================================================
             EMPTY
          ================================================= */

          <div className="flex min-h-[280px] items-center justify-center px-5">
            <div className="max-w-md text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </span>

              <h3 className="mt-4 text-sm font-semibold text-ink-900">
                No exceptions detected
              </h3>

              <p className="mt-1 text-sm leading-relaxed text-ink-500">
                No HR cases currently match the exception
                detection rules.
              </p>
            </div>
          </div>
        ) : (
          /* =================================================
             EXCEPTION LIST
          ================================================= */

          <div className="divide-y divide-ink-100">
            {filteredExceptions.map((item) => (
              <div
                key={item.id}
                className="p-5"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  {/* LEFT */}

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${severityClass(
                          item.severity
                        )}`}
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />

                        {severityLabel(
                          item.severity
                        )}
                      </span>

                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(
                          item.status
                        )}`}
                      >
                        {statusLabel(item.status)}
                      </span>

                      <span className="rounded-full bg-ink-50 px-2.5 py-1 text-xs font-medium text-ink-600">
                        {item.category}
                      </span>
                    </div>

                    <h3 className="mt-3 text-base font-semibold text-ink-900">
                      {item.title}
                    </h3>

                    {item.description && (
                      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-500">
                        {item.description}
                      </p>
                    )}

                    <div className="mt-4 rounded-lg bg-amber-50 px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
                        Why this was flagged
                      </p>

                      <p className="mt-1 text-sm text-amber-800">
                        {item.reason}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-500">
                      <span className="inline-flex items-center gap-1.5">
                        <UserRound className="h-3.5 w-3.5" />
                        Owner: {item.owner}
                      </span>

                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 className="h-3.5 w-3.5" />
                        Created:{" "}
                        {formatDate(item.createdAt)}
                      </span>

                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 className="h-3.5 w-3.5" />
                        Deadline:{" "}
                        {formatDate(item.dueAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* =====================================================
          EXPLANATION
      ===================================================== */}

      <div className="mt-6 card p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <AlertTriangle className="h-4 w-4" />
          </span>

          <div>
            <h2 className="text-sm font-semibold text-ink-900">
              How exception detection works
            </h2>

            <p className="mt-1 text-sm leading-relaxed text-ink-500">
              The system reviews HR request records and
              surfaces cases that are urgent, incomplete,
              unresolved, rejected, cancelled, or otherwise
              likely to require human attention. The detector
              highlights these cases for review rather than
              making the HR decision automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}