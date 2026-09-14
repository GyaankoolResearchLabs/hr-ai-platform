import { useCallback, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { platformAdminService } from "../../services/platformAdminService";

/*
|--------------------------------------------------------------------------
| PLATFORM ADMIN — ERROR LOGS
|--------------------------------------------------------------------------
|
| /platform-admin/logs — operator-only, never linked from anywhere in the
| customer-facing app (no sidebar entry, no nav link, not nested under
| AppLayout/ProtectedRoute). The URL itself is the only way in.
|
| This page does not gate itself by role or by any allow-list — that
| would mean shipping the allow-list logic to the browser. It just calls
| the API; the API 404s for anyone not in platform_admins
| (middleware/requirePlatformAdmin.js), and this page renders that 404 as
| a plain "not found" state, same tone as the rest of the app.
|--------------------------------------------------------------------------
*/

const PAGE_SIZE = 25;

const EMPTY_PAGINATION = {
  page: 1,
  limit: PAGE_SIZE,
  total: 0,
  total_pages: 0,
  has_next_page: false,
  has_previous_page: false,
};

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function eventTypeClasses(eventType) {
  const value = String(eventType || "").toLowerCase();
  if (value.includes("login")) return "border-amber-200 bg-amber-50 text-amber-700";
  if (value.includes("token")) return "border-orange-200 bg-orange-50 text-orange-700";
  if (value.includes("unhandled")) return "border-red-200 bg-red-50 text-red-700";
  if (value.includes("client")) return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-gray-200 bg-gray-50 text-gray-700";
}

export default function PlatformAdminLogs() {
  const { isAuthenticated, authLoading } = useAuth();
  const location = useLocation();

  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState("");
  const [eventTypes, setEventTypes] = useState([]);
  const [page, setPage] = useState(1);

  const [selectedLog, setSelectedLog] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const response = await platformAdminService.getLogs({
        search: search || undefined,
        event_type: eventType || undefined,
        page,
        limit: PAGE_SIZE,
      });

      setLogs(response?.data || []);
      setPagination(response?.pagination || EMPTY_PAGINATION);
      setNotFound(false);
    } catch (error) {
      if (error?.response?.status === 404) {
        setNotFound(true);
      } else {
        setLoadError(
          error?.response?.data?.message || "Could not load logs."
        );
      }
    } finally {
      setLoading(false);
    }
  }, [search, eventType, page]);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadLogs();
  }, [isAuthenticated, loadLogs]);

  useEffect(() => {
    if (!isAuthenticated) return;

    platformAdminService
      .getFilters()
      .then((response) => setEventTypes(response?.data?.event_types || []))
      .catch(() => {});
  }, [isAuthenticated]);

  async function openDetail(id) {
    setDetailLoading(true);
    try {
      const response = await platformAdminService.getLog(id);
      setSelectedLog(response?.data || null);
    } catch {
      setSelectedLog(null);
    } finally {
      setDetailLoading(false);
    }
  }

  /* =========================================================
     AUTH GATE
  ========================================================= */

  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-canvas">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate to="/login" state={{ from: location }} replace />
    );
  }

  /* =========================================================
     NOT FOUND (not a platform admin, or the id doesn't exist)
     Deliberately generic — no mention of "admin" or "permission".
  ========================================================= */

  if (notFound) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-2 bg-canvas px-4 text-center">
        <p className="text-lg font-semibold text-ink-800">Page not found</p>
        <p className="text-sm text-ink-500">
          The page you're looking for doesn't exist.
        </p>
      </div>
    );
  }

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="min-h-screen bg-canvas px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-brand-700" />
            <div>
              <h1 className="text-lg font-semibold text-ink-900">
                Platform Error Logs
              </h1>
              <p className="text-sm text-ink-500">
                Internal monitoring — login failures, unhandled exceptions, and
                client-reported errors across every organization.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadLogs}
            className="flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </header>

        {/* FILTERS */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-200 bg-white p-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              placeholder="Search message, route, email..."
              className="w-full rounded-lg border border-ink-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500"
            />
          </div>

          <select
            value={eventType}
            onChange={(event) => {
              setPage(1);
              setEventType(event.target.value);
            }}
            className="rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
          >
            <option value="">All event types</option>
            {eventTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {loadError && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {loadError}
          </div>
        )}

        {/* TABLE */}
        <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Message</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-brand-600" />
                  </td>
                </tr>
              )}

              {!loading && logs.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-sm text-ink-400"
                  >
                    No logs match the current filters.
                  </td>
                </tr>
              )}

              {!loading &&
                logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => openDetail(log.id)}
                    className="cursor-pointer border-b border-ink-50 last:border-0 hover:bg-ink-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-ink-600">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${eventTypeClasses(
                          log.event_type
                        )}`}
                      >
                        {log.event_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-600">
                      {log.route || "—"}
                    </td>
                    <td className="px-4 py-3 text-ink-600">
                      {log.user_email || "—"}
                    </td>
                    <td className="max-w-[320px] truncate px-4 py-3 text-ink-700">
                      {log.message}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {pagination.total > 0 && (
          <div className="flex items-center justify-between text-sm text-ink-500">
            <span>
              Page {pagination.page} of {pagination.total_pages} —{" "}
              {pagination.total} total
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!pagination.has_previous_page}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="flex items-center gap-1 rounded-lg border border-ink-200 px-3 py-1.5 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <button
                type="button"
                disabled={!pagination.has_next_page}
                onClick={() => setPage((current) => current + 1)}
                className="flex items-center gap-1 rounded-lg border border-ink-200 px-3 py-1.5 disabled:opacity-40"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DETAIL PANEL */}
      {(selectedLog || detailLoading) && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink-900">
                Log detail
              </h2>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="rounded-lg p-1 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {detailLoading && (
              <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
            )}

            {!detailLoading && selectedLog && (
              <dl className="space-y-4 text-sm">
                <Field label="Event type" value={selectedLog.event_type} />
                <Field label="Time" value={formatDateTime(selectedLog.created_at)} />
                <Field label="Route" value={selectedLog.route} />
                <Field label="Method" value={selectedLog.method} />
                <Field label="User email" value={selectedLog.user_email} />
                <Field label="User ID" value={selectedLog.user_id} />
                <Field label="IP address" value={selectedLog.ip_address} />
                <Field label="User agent" value={selectedLog.user_agent} />
                <Field label="Message" value={selectedLog.message} />
                {selectedLog.stack && (
                  <div>
                    <dt className="mb-1 font-medium text-ink-500">Stack trace</dt>
                    <dd>
                      <pre className="max-h-80 overflow-auto rounded-lg bg-ink-900 p-3 text-xs text-ink-50">
                        {selectedLog.stack}
                      </pre>
                    </dd>
                  </div>
                )}
                {selectedLog.context &&
                  Object.keys(selectedLog.context).length > 0 && (
                    <div>
                      <dt className="mb-1 font-medium text-ink-500">Context</dt>
                      <dd>
                        <pre className="max-h-60 overflow-auto rounded-lg bg-ink-50 p-3 text-xs text-ink-700">
                          {JSON.stringify(selectedLog.context, null, 2)}
                        </pre>
                      </dd>
                    </div>
                  )}
              </dl>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <dt className="font-medium text-ink-500">{label}</dt>
      <dd className="break-words text-ink-800">{value || "—"}</dd>
    </div>
  );
}
