import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  FileText,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import api from "../../services/api";

/* =========================================================
   CONSTANTS
========================================================= */

const PAGE_SIZE = 25;

const EMPTY_SUMMARY = {
  total_events: 0,
  today_events: 0,
  successful_events: 0,
  failed_events: 0,
};

const EMPTY_FILTERS = {
  actions: [],
  resource_types: [],
  statuses: [],
};

/* =========================================================
   HELPERS
========================================================= */

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const difference =
    Date.now() - date.getTime();

  if (difference < 0) {
    return formatDateTime(value);
  }

  const seconds = Math.floor(
    difference / 1000,
  );

  if (seconds < 60) {
    return "Just now";
  }

  const minutes = Math.floor(
    seconds / 60,
  );

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(
    minutes / 60,
  );

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(
    hours / 24,
  );

  if (days < 7) {
    return `${days}d ago`;
  }

  return formatDateTime(value);
}

function formatAction(action) {
  if (!action) {
    return "Unknown action";
  }

  return String(action)
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function formatResourceType(resourceType) {
  if (!resourceType) {
    return "Unknown";
  }

  return String(resourceType)
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function getActionLabel(action) {
  const value = String(
    action || "",
  ).toLowerCase();

  if (value.includes("view")) {
    return "Viewed";
  }

  if (value.includes("create")) {
    return "Created";
  }

  if (value.includes("update")) {
    return "Updated";
  }

  if (
    value.includes("delete") ||
    value.includes("remove")
  ) {
    return "Deleted";
  }

  if (
    value.includes("import") ||
    value.includes("bulk")
  ) {
    return "Imported";
  }

  if (value.includes("login")) {
    return "Signed in";
  }

  if (value.includes("logout")) {
    return "Signed out";
  }

  if (value.includes("export")) {
    return "Exported";
  }

  if (value.includes("sync")) {
    return "Synchronized";
  }

  return formatAction(action);
}

function getActionClasses(action) {
  const value = String(
    action || "",
  ).toLowerCase();

  if (value.includes("delete")) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (
    value.includes("create") ||
    value.includes("import")
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (value.includes("update")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (value.includes("view")) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (value.includes("sync")) {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }

  return "border-gray-200 bg-gray-50 text-gray-700";
}

function getStatusClasses(status) {
  if (
    String(status || "").toLowerCase() ===
    "success"
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-red-200 bg-red-50 text-red-700";
}

function getStatusLabel(status) {
  if (
    String(status || "").toLowerCase() ===
    "success"
  ) {
    return "Success";
  }

  return "Failed";
}

function getActorName(log) {
  if (log?.actor?.email) {
    return log.actor.email;
  }

  if (log?.user_email) {
    return log.user_email;
  }

  if (log?.user?.email) {
    return log.user.email;
  }

  if (log?.user_id) {
    return `${String(log.user_id).slice(
      0,
      8,
    )}...`;
  }

  return "Unknown user";
}

function getInitials(value) {
  if (!value) {
    return "?";
  }

  const words = String(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 1) {
    return words[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    words[0][0] +
    words[words.length - 1][0]
  ).toUpperCase();
}

function normalizeLogsResponse(response) {
  const body =
    response?.data ?? {};

  let logs = [];

  if (Array.isArray(body)) {
    logs = body;
  } else if (
    Array.isArray(body.data)
  ) {
    logs = body.data;
  } else if (
    Array.isArray(body.logs)
  ) {
    logs = body.logs;
  } else if (
    Array.isArray(body.events)
  ) {
    logs = body.events;
  }

  const pagination =
    body.pagination || {
      page: 1,
      limit: PAGE_SIZE,
      total: logs.length,
      total_pages:
        logs.length > 0 ? 1 : 0,
      has_next_page: false,
      has_previous_page: false,
    };

  return {
    logs,
    pagination,
  };
}

function normalizeSummaryResponse(
  response,
) {
  const body =
    response?.data ?? {};

  if (
    body?.data &&
    typeof body.data === "object" &&
    !Array.isArray(body.data)
  ) {
    return {
      ...EMPTY_SUMMARY,
      ...body.data,
    };
  }

  if (
    body?.summary &&
    typeof body.summary === "object"
  ) {
    return {
      ...EMPTY_SUMMARY,
      ...body.summary,
    };
  }

  if (
    typeof body === "object" &&
    !Array.isArray(body)
  ) {
    return {
      ...EMPTY_SUMMARY,
      ...body,
    };
  }

  return EMPTY_SUMMARY;
}

function normalizeFiltersResponse(
  response,
) {
  const body =
    response?.data ?? {};

  const data =
    body?.data &&
    typeof body.data === "object"
      ? body.data
      : body;

  return {
    actions: Array.isArray(
      data?.actions,
    )
      ? data.actions
      : [],
    resource_types:
      Array.isArray(
        data?.resource_types,
      )
        ? data.resource_types
        : [],
    statuses: Array.isArray(
      data?.statuses,
    )
      ? data.statuses
      : [],
  };
}

/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  label,
  value,
  icon: Icon,
  description,
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">
            {label}
          </p>

          <p className="mt-2 text-2xl font-semibold text-gray-950">
            {value}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            {description}
          </p>
        </div>

        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-600">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

/* =========================================================
   EMPTY STATE
========================================================= */

function EmptyState({
  hasFilters,
  onClearFilters,
}) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-500">
        <ShieldCheck className="h-7 w-7" />
      </div>

      <h3 className="mt-4 text-base font-semibold text-gray-900">
        {hasFilters
          ? "No matching audit events"
          : "No audit events yet"}
      </h3>

      <p className="mt-2 max-w-md text-sm leading-6 text-gray-500">
        {hasFilters
          ? "Try changing your search or filters to find the activity you are looking for."
          : "Audit activity will appear here as users perform tracked actions across your HR platform."}
      </p>

      {hasFilters ? (
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}

/* =========================================================
   DETAIL ROW
========================================================= */

function DetailRow({
  label,
  value,
  mono = false,
}) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-gray-100 py-3 last:border-b-0 sm:grid-cols-[150px_1fr] sm:gap-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </dt>

      <dd
        className={`break-words text-sm text-gray-800 ${
          mono
            ? "font-mono text-xs"
            : ""
        }`}
      >
        {value || "—"}
      </dd>
    </div>
  );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function AccessAuditLogViewer() {
  const navigate = useNavigate();

  const [logs, setLogs] =
    useState([]);

  const [summary, setSummary] =
    useState(EMPTY_SUMMARY);

  const [
    availableFilters,
    setAvailableFilters,
  ] = useState(EMPTY_FILTERS);

  const [pagination, setPagination] =
    useState({
      page: 1,
      limit: PAGE_SIZE,
      total: 0,
      total_pages: 0,
      has_next_page: false,
      has_previous_page: false,
    });

  const [selectedLog, setSelectedLog] =
    useState(null);

  const [searchInput, setSearchInput] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [actionFilter, setActionFilter] =
    useState("");

  const [
    resourceFilter,
    setResourceFilter,
  ] = useState("");

  const [statusFilter, setStatusFilter] =
    useState("");

  const [fromDate, setFromDate] =
    useState("");

  const [toDate, setToDate] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [
    summaryLoading,
    setSummaryLoading,
  ] = useState(true);

  const [
    filtersLoading,
    setFiltersLoading,
  ] = useState(true);

  const [
    detailLoading,
    setDetailLoading,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    showFilters,
    setShowFilters,
  ] = useState(false);

  /* =======================================================
     LOAD LOGS
  ======================================================= */

  const loadLogs = useCallback(
    async ({
      page = 1,
      showRefresh = false,
    } = {}) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage("");

        const params = {
          page,
          limit: PAGE_SIZE,
        };

        if (search.trim()) {
          params.search =
            search.trim();
        }

        if (actionFilter) {
          params.action =
            actionFilter;
        }

        if (resourceFilter) {
          params.resource_type =
            resourceFilter;
        }

        if (statusFilter) {
          params.status =
            statusFilter;
        }

        if (fromDate) {
          params.from =
            `${fromDate}T00:00:00.000Z`;
        }

        if (toDate) {
          params.to =
            `${toDate}T23:59:59.999Z`;
        }

        console.log(
          "[AccessAuditLogViewer] Loading audit logs:",
          params,
        );

        const response =
          await api.get(
            "/audit-logs",
            {
              params,
            },
          );

        console.log(
          "[AccessAuditLogViewer] Audit logs response:",
          response?.data,
        );

        const {
          logs: normalizedLogs,
          pagination:
            normalizedPagination,
        } =
          normalizeLogsResponse(
            response,
          );

        setLogs(normalizedLogs);

        setPagination(
          normalizedPagination,
        );
      } catch (error) {
        console.error(
          "[AccessAuditLogViewer] Load logs error:",
          error,
        );

        const message =
          error?.response?.data
            ?.message ||
          error?.message ||
          "Failed to load audit logs.";

        setErrorMessage(message);

        setLogs([]);

        setPagination({
          page: 1,
          limit: PAGE_SIZE,
          total: 0,
          total_pages: 0,
          has_next_page: false,
          has_previous_page: false,
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      search,
      actionFilter,
      resourceFilter,
      statusFilter,
      fromDate,
      toDate,
    ],
  );

  /* =======================================================
     LOAD SUMMARY
  ======================================================= */

  const loadSummary =
    useCallback(async () => {
      try {
        setSummaryLoading(true);

        const response =
          await api.get(
            "/audit-logs/summary",
          );

        console.log(
          "[AccessAuditLogViewer] Summary response:",
          response?.data,
        );

        setSummary(
          normalizeSummaryResponse(
            response,
          ),
        );
      } catch (error) {
        console.error(
          "[AccessAuditLogViewer] Load summary error:",
          error,
        );

        setSummary(
          EMPTY_SUMMARY,
        );
      } finally {
        setSummaryLoading(false);
      }
    }, []);

  /* =======================================================
     LOAD FILTERS
  ======================================================= */

  const loadFilters =
    useCallback(async () => {
      try {
        setFiltersLoading(true);

        const response =
          await api.get(
            "/audit-logs/filters",
          );

        console.log(
          "[AccessAuditLogViewer] Filters response:",
          response?.data,
        );

        setAvailableFilters(
          normalizeFiltersResponse(
            response,
          ),
        );
      } catch (error) {
        console.error(
          "[AccessAuditLogViewer] Load filters error:",
          error,
        );

        setAvailableFilters(
          EMPTY_FILTERS,
        );
      } finally {
        setFiltersLoading(false);
      }
    }, []);

  /* =======================================================
     INITIAL SUMMARY + FILTER LOAD
  ======================================================= */

  useEffect(() => {
    loadSummary();
    loadFilters();
  }, [
    loadSummary,
    loadFilters,
  ]);

  /* =======================================================
     SEARCH DEBOUNCE
  ======================================================= */

  useEffect(() => {
    const timer =
      window.setTimeout(() => {
        setSearch(
          searchInput.trim(),
        );
      }, 350);

    return () => {
      window.clearTimeout(
        timer,
      );
    };
  }, [searchInput]);

  /* =======================================================
     LOAD LOGS WHEN FILTERS CHANGE
  ======================================================= */

  useEffect(() => {
    loadLogs({
      page: 1,
    });
  }, [
    loadLogs,
  ]);

  /* =======================================================
     REFRESH
  ======================================================= */

  async function handleRefresh() {
    await Promise.all([
      loadLogs({
        page:
          pagination.page || 1,
        showRefresh: true,
      }),
      loadSummary(),
      loadFilters(),
    ]);
  }

  /* =======================================================
     PAGINATION
  ======================================================= */

  function goToPage(page) {
    if (
      page < 1 ||
      page >
        pagination.total_pages ||
      page === pagination.page
    ) {
      return;
    }

    loadLogs({
      page,
    });
  }

  const pageNumbers =
    useMemo(() => {
      const totalPages =
        Number(
          pagination.total_pages ||
            0,
        );

      const currentPage =
        Number(
          pagination.page || 1,
        );

      if (totalPages <= 1) {
        return [];
      }

      const pages = [];

      const start = Math.max(
        1,
        currentPage - 2,
      );

      const end = Math.min(
        totalPages,
        currentPage + 2,
      );

      for (
        let page = start;
        page <= end;
        page += 1
      ) {
        pages.push(page);
      }

      return pages;
    }, [
      pagination.page,
      pagination.total_pages,
    ]);

  /* =======================================================
     FILTERS
  ======================================================= */

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setActionFilter("");
    setResourceFilter("");
    setStatusFilter("");
    setFromDate("");
    setToDate("");
  }

  const hasActiveFilters =
    Boolean(
      search ||
        actionFilter ||
        resourceFilter ||
        statusFilter ||
        fromDate ||
        toDate,
    );

  /* =======================================================
     DETAIL
  ======================================================= */

  async function openLogDetail(log) {
    setSelectedLog(log);
    setDetailLoading(true);

    try {
      const response =
        await api.get(
          `/audit-logs/${log.id}`,
        );

      console.log(
        "[AccessAuditLogViewer] Detail response:",
        response?.data,
      );

      const body =
        response?.data || {};

      const detail =
        body?.data ||
        body?.log ||
        body;

      if (
        detail &&
        typeof detail ===
          "object"
      ) {
        setSelectedLog(detail);
      }
    } catch (error) {
      console.error(
        "[AccessAuditLogViewer] Load audit detail error:",
        error,
      );

      setErrorMessage(
        error?.response?.data
          ?.message ||
          error?.message ||
          "Failed to load audit event details.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  function closeLogDetail() {
    if (detailLoading) {
      return;
    }

    setSelectedLog(null);
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="min-h-full bg-gray-50">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        {/* =================================================
            HEADER
        ================================================= */}

        <div className="mb-6">
          <button
            type="button"
            onClick={() =>
              navigate(-1)
            }
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />

            Back
          </button>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-white">
                  <ShieldCheck className="h-5 w-5" />
                </div>

                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-gray-950">
                    Access & Audit Log Viewer
                  </h1>

                  <p className="mt-1 text-sm text-gray-500">
                    Full visibility into who accessed what, when.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={
                refreshing ||
                loading
              }
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}

              Refresh
            </button>
          </div>
        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {errorMessage ? (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

            <div className="flex-1">
              <p className="font-medium">
                Unable to load audit logs
              </p>

              <p className="mt-1 break-words">
                {errorMessage}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setErrorMessage("")
              }
              className="text-red-500 transition hover:text-red-700"
              aria-label="Dismiss error"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {/* =================================================
            SUMMARY
        ================================================= */}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Total Events"
            value={
              summaryLoading
                ? "—"
                : Number(
                    summary.total_events ||
                      0,
                  )
            }
            icon={Activity}
            description="All recorded audit activity"
          />

          <SummaryCard
            label="Today's Events"
            value={
              summaryLoading
                ? "—"
                : Number(
                    summary.today_events ||
                      0,
                  )
            }
            icon={Clock3}
            description="Events recorded today"
          />

          <SummaryCard
            label="Successful"
            value={
              summaryLoading
                ? "—"
                : Number(
                    summary.successful_events ||
                      0,
                  )
            }
            icon={CheckCircle2}
            description="Completed actions"
          />

          <SummaryCard
            label="Failed"
            value={
              summaryLoading
                ? "—"
                : Number(
                    summary.failed_events ||
                      0,
                  )
            }
            icon={XCircle}
            description="Actions that failed"
          />
        </div>

        {/* =================================================
            SEARCH / FILTERS
        ================================================= */}

        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

              <input
                type="text"
                value={searchInput}
                onChange={(event) =>
                  setSearchInput(
                    event.target.value,
                  )
                }
                placeholder="Search actions, resources, descriptions..."
                className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-500 focus:ring-2 focus:ring-gray-100"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                setShowFilters(
                  (previous) =>
                    !previous,
                )
              }
              className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition ${
                showFilters ||
                hasActiveFilters
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Filter className="h-4 w-4" />

              Filters

              {hasActiveFilters ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-semibold text-gray-900">
                  {
                    [
                      actionFilter,
                      resourceFilter,
                      statusFilter,
                      fromDate,
                      toDate,
                    ].filter(
                      Boolean,
                    ).length +
                    (search
                      ? 1
                      : 0)
                  }
                </span>
              ) : null}
            </button>

            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-gray-500 transition hover:bg-gray-50 hover:text-gray-900"
              >
                <X className="h-4 w-4" />

                Clear
              </button>
            ) : null}
          </div>

          {showFilters ? (
            <div className="mt-4 grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {/* ACTION */}

              <div>
                <label
                  htmlFor="audit-action"
                  className="mb-1.5 block text-xs font-medium text-gray-500"
                >
                  Action
                </label>

                <select
                  id="audit-action"
                  value={actionFilter}
                  onChange={(event) =>
                    setActionFilter(
                      event.target.value,
                    )
                  }
                  disabled={
                    filtersLoading
                  }
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-100"
                >
                  <option value="">
                    All actions
                  </option>

                  {availableFilters.actions.map(
                    (action) => (
                      <option
                        key={action}
                        value={action}
                      >
                        {formatAction(
                          action,
                        )}
                      </option>
                    ),
                  )}
                </select>
              </div>

              {/* RESOURCE */}

              <div>
                <label
                  htmlFor="audit-resource"
                  className="mb-1.5 block text-xs font-medium text-gray-500"
                >
                  Resource
                </label>

                <select
                  id="audit-resource"
                  value={resourceFilter}
                  onChange={(event) =>
                    setResourceFilter(
                      event.target.value,
                    )
                  }
                  disabled={
                    filtersLoading
                  }
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-100"
                >
                  <option value="">
                    All resources
                  </option>

                  {availableFilters.resource_types.map(
                    (resource) => (
                      <option
                        key={resource}
                        value={resource}
                      >
                        {formatResourceType(
                          resource,
                        )}
                      </option>
                    ),
                  )}
                </select>
              </div>

              {/* STATUS */}

              <div>
                <label
                  htmlFor="audit-status"
                  className="mb-1.5 block text-xs font-medium text-gray-500"
                >
                  Status
                </label>

                <select
                  id="audit-status"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value,
                    )
                  }
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-100"
                >
                  <option value="">
                    All statuses
                  </option>

                  <option value="success">
                    Success
                  </option>

                  <option value="failed">
                    Failed
                  </option>
                </select>
              </div>

              {/* FROM DATE */}

              <div>
                <label
                  htmlFor="audit-from"
                  className="mb-1.5 block text-xs font-medium text-gray-500"
                >
                  From date
                </label>

                <input
                  id="audit-from"
                  type="date"
                  value={fromDate}
                  onChange={(event) =>
                    setFromDate(
                      event.target.value,
                    )
                  }
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-100"
                />
              </div>

              {/* TO DATE */}

              <div>
                <label
                  htmlFor="audit-to"
                  className="mb-1.5 block text-xs font-medium text-gray-500"
                >
                  To date
                </label>

                <input
                  id="audit-to"
                  type="date"
                  value={toDate}
                  onChange={(event) =>
                    setToDate(
                      event.target.value,
                    )
                  }
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-100"
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* =================================================
            AUDIT TABLE
        ================================================= */}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="flex flex-col gap-2 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Audit Events
              </h2>

              <p className="mt-0.5 text-xs text-gray-500">
                {pagination.total || 0}{" "}
                {Number(
                  pagination.total || 0,
                ) === 1
                  ? "event"
                  : "events"}{" "}
                found
              </p>
            </div>

            {hasActiveFilters ? (
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                <Filter className="h-3 w-3" />

                Filters active
              </span>
            ) : null}
          </div>

          {loading ? (
            <div className="flex min-h-[360px] items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-gray-500">
                <Loader2 className="h-7 w-7 animate-spin" />

                <p className="text-sm">
                  Loading audit events...
                </p>
              </div>
            </div>
          ) : logs.length === 0 ? (
            <EmptyState
              hasFilters={
                hasActiveFilters
              }
              onClearFilters={
                clearFilters
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px]">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/80">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        User
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Action
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Resource
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Description
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Status
                      </th>

                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        When
                      </th>

                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Details
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {logs.map(
                      (log) => (
                        <tr
                          key={log.id}
                          className="transition hover:bg-gray-50/70"
                        >
                          {/* USER */}

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                                {getInitials(
                                  getActorName(
                                    log,
                                  ),
                                )}
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-gray-900">
                                  {getActorName(
                                    log,
                                  )}
                                </p>

                                <p className="mt-0.5 truncate text-xs text-gray-400">
                                  {log.actor
                                    ?.is_current_user
                                    ? "You"
                                    : log.user_id
                                      ? `User ${String(
                                          log.user_id,
                                        ).slice(
                                          0,
                                          8,
                                        )}`
                                      : "Unknown user"}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* ACTION */}

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getActionClasses(
                                log.action,
                              )}`}
                            >
                              {getActionLabel(
                                log.action,
                              )}
                            </span>
                          </td>

                          {/* RESOURCE */}

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                                <FileText className="h-4 w-4" />
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-gray-900">
                                  {log.resource_name ||
                                    formatResourceType(
                                      log.resource_type,
                                    )}
                                </p>

                                <p className="mt-0.5 truncate text-xs text-gray-400">
                                  {formatResourceType(
                                    log.resource_type,
                                  )}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* DESCRIPTION */}

                          <td className="max-w-[320px] px-5 py-4">
                            <p className="line-clamp-2 text-sm text-gray-600">
                              {log.description ||
                                "No description"}
                            </p>
                          </td>

                          {/* STATUS */}

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClasses(
                                log.status,
                              )}`}
                            >
                              {String(
                                log.status ||
                                  "",
                              ).toLowerCase() ===
                              "success" ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <XCircle className="h-3 w-3" />
                              )}

                              {getStatusLabel(
                                log.status,
                              )}
                            </span>
                          </td>

                          {/* WHEN */}

                          <td className="px-5 py-4">
                            <div>
                              <p className="text-sm text-gray-800">
                                {formatRelativeTime(
                                  log.created_at,
                                )}
                              </p>

                              <p className="mt-0.5 text-xs text-gray-400">
                                {formatDateTime(
                                  log.created_at,
                                )}
                              </p>
                            </div>
                          </td>

                          {/* DETAILS */}

                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                openLogDetail(
                                  log,
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
                            >
                              <Eye className="h-3.5 w-3.5" />

                              View
                            </button>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              {/* =================================================
                  PAGINATION
              ================================================= */}

              <div className="flex flex-col gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-gray-500">
                  Page{" "}
                  <span className="font-medium text-gray-700">
                    {pagination.page ||
                      1}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-gray-700">
                    {pagination.total_pages ||
                      1}
                  </span>
                </p>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      goToPage(
                        Number(
                          pagination.page ||
                            1,
                        ) - 1,
                      )
                    }
                    disabled={
                      !pagination.has_previous_page
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  {pageNumbers.map(
                    (page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() =>
                          goToPage(
                            page,
                          )
                        }
                        className={`flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-xs font-medium transition ${
                          page ===
                          pagination.page
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {page}
                      </button>
                    ),
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      goToPage(
                        Number(
                          pagination.page ||
                            1,
                        ) + 1,
                      )
                    }
                    disabled={
                      !pagination.has_next_page
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* =======================================================
          DETAIL DRAWER
      ======================================================= */}

      {selectedLog ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close audit details"
            onClick={closeLogDetail}
            className="absolute inset-0 bg-black/30"
          />

          <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
            {/* HEADER */}

            <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
              <div className="min-w-0 pr-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900 text-white">
                    <ShieldCheck className="h-4 w-4" />
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Audit Event
                    </p>

                    <h2 className="mt-0.5 text-lg font-semibold text-gray-950">
                      {getActionLabel(
                        selectedLog.action,
                      )}
                    </h2>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={
                  closeLogDetail
                }
                disabled={
                  detailLoading
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* CONTENT */}

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {detailLoading ? (
                <div className="flex min-h-[300px] items-center justify-center">
                  <div className="flex flex-col items-center gap-3 text-gray-500">
                    <Loader2 className="h-6 w-6 animate-spin" />

                    <p className="text-sm">
                      Loading event details...
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  {/* STATUS */}

                  <div className="mb-6 flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                        Result
                      </p>

                      <p className="mt-1 text-sm font-medium text-gray-900">
                        {getStatusLabel(
                          selectedLog.status,
                        )}
                      </p>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${getStatusClasses(
                        selectedLog.status,
                      )}`}
                    >
                      {String(
                        selectedLog.status ||
                          "",
                      ).toLowerCase() ===
                      "success" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}

                      {getStatusLabel(
                        selectedLog.status,
                      )}
                    </span>
                  </div>

                  {/* EVENT */}

                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-gray-900">
                      Event
                    </h3>

                    <dl className="rounded-xl border border-gray-200 px-4">
                      <DetailRow
                        label="Action"
                        value={formatAction(
                          selectedLog.action,
                        )}
                      />

                      <DetailRow
                        label="Resource"
                        value={formatResourceType(
                          selectedLog.resource_type,
                        )}
                      />

                      <DetailRow
                        label="Resource name"
                        value={
                          selectedLog.resource_name
                        }
                      />

                      <DetailRow
                        label="Description"
                        value={
                          selectedLog.description
                        }
                      />

                      <DetailRow
                        label="Timestamp"
                        value={formatDateTime(
                          selectedLog.created_at,
                        )}
                      />
                    </dl>
                  </section>

                  {/* USER */}

                  <section className="mt-6">
                    <h3 className="mb-2 text-sm font-semibold text-gray-900">
                      User
                    </h3>

                    <dl className="rounded-xl border border-gray-200 px-4">
                      <DetailRow
                        label="User"
                        value={getActorName(
                          selectedLog,
                        )}
                      />

                      <DetailRow
                        label="User ID"
                        value={
                          selectedLog.user_id
                        }
                        mono
                      />
                    </dl>
                  </section>

                  {/* RESOURCE */}

                  <section className="mt-6">
                    <h3 className="mb-2 text-sm font-semibold text-gray-900">
                      Resource
                    </h3>

                    <dl className="rounded-xl border border-gray-200 px-4">
                      <DetailRow
                        label="Resource ID"
                        value={
                          selectedLog.resource_id
                        }
                        mono
                      />

                      <DetailRow
                        label="Resource type"
                        value={formatResourceType(
                          selectedLog.resource_type,
                        )}
                      />

                      <DetailRow
                        label="Resource name"
                        value={
                          selectedLog.resource_name
                        }
                      />
                    </dl>
                  </section>

                  {/* REQUEST */}

                  <section className="mt-6">
                    <h3 className="mb-2 text-sm font-semibold text-gray-900">
                      Request context
                    </h3>

                    <dl className="rounded-xl border border-gray-200 px-4">
                      <DetailRow
                        label="IP address"
                        value={
                          selectedLog.ip_address
                        }
                        mono
                      />

                      <DetailRow
                        label="User agent"
                        value={
                          selectedLog.user_agent
                        }
                      />
                    </dl>
                  </section>

                  {/* METADATA */}

                  <section className="mt-6">
                    <h3 className="mb-2 text-sm font-semibold text-gray-900">
                      Additional metadata
                    </h3>

                    <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-950 p-4">
                      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-gray-200">
                        {JSON.stringify(
                          selectedLog.metadata ||
                            {},
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                  </section>
                </div>
              )}
            </div>

            {/* FOOTER */}

            <div className="border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={
                  closeLogDetail
                }
                disabled={
                  detailLoading
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Close
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}