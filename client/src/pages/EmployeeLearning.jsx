import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock3,
  GraduationCap,
  Loader2,
  X,
} from "lucide-react";

import employeeLearningService from "../services/employeeLearningService";

const STATUS_META = {
  completed: {
    label: "Completed",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  overdue: {
    label: "Overdue",
    className: "bg-red-50 text-red-700 border-red-200",
    icon: AlertTriangle,
  },
  in_progress: {
    label: "In Progress",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock3,
  },
  not_started: {
    label: "Not Started",
    className: "bg-ink-50 text-ink-600 border-ink-200",
    icon: Circle,
  },
};

function getStatusMeta(status) {
  return STATUS_META[status] || STATUS_META.not_started;
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

function ProgressBar({ value }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
      <div
        className="h-full rounded-full bg-brand-600 transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export default function EmployeeLearning() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [updating, setUpdating] = useState(false);

  async function loadAssignments() {
    try {
      setLoading(true);
      setError("");

      const data = await employeeLearningService.list();

      setAssignments(data);
    } catch (err) {
      console.error("Employee learning load error:", err);

      setError(
        err?.response?.data?.message ||
          "Unable to load your assigned courses.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAssignments();
  }, []);

  async function openAssignment(id) {
    setSelectedId(id);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);

    try {
      const data = await employeeLearningService.getById(id);

      setDetail(data);
    } catch (err) {
      console.error("Assigned course detail load error:", err);

      setDetailError(
        err?.response?.data?.message ||
          "Unable to load this course.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  function closeAssignment() {
    setSelectedId(null);
    setDetail(null);
    setDetailError("");
  }

  function patchListItem(id, patch) {
    setAssignments((current) =>
      current.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    );
  }

  async function bumpProgress(amount) {
    if (!selectedId || !detail) {
      return;
    }

    const nextValue = Math.min(
      100,
      Math.max(0, detail.progress.progress_percentage + amount),
    );

    try {
      setUpdating(true);

      const result = await employeeLearningService.updateProgress(
        selectedId,
        nextValue,
      );

      setDetail((current) => ({
        ...current,
        progress: result.progress,
        status: result.status,
      }));

      patchListItem(selectedId, {
        progress_percentage: result.progress.progress_percentage,
        status: result.status,
        started_at: result.progress.started_at,
        completed_at: result.progress.completed_at,
      });
    } catch (err) {
      console.error("Progress update error:", err);

      setDetailError(
        err?.response?.data?.message ||
          "Unable to update progress.",
      );
    } finally {
      setUpdating(false);
    }
  }

  async function handleMarkComplete() {
    if (!selectedId) {
      return;
    }

    try {
      setUpdating(true);

      const result = await employeeLearningService.markComplete(selectedId);

      setDetail((current) => ({
        ...current,
        progress: result.progress,
        status: result.status,
      }));

      patchListItem(selectedId, {
        progress_percentage: result.progress.progress_percentage,
        status: result.status,
        started_at: result.progress.started_at,
        completed_at: result.progress.completed_at,
      });
    } catch (err) {
      console.error("Mark complete error:", err);

      setDetailError(
        err?.response?.data?.message ||
          "Unable to mark this course complete.",
      );
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-ink-500">
          <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
          Loading your assigned courses...
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
            Learning
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Your assigned courses, overdue first.
          </p>
        </div>

        <button
          type="button"
          onClick={loadAssignments}
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

      <section className="card overflow-hidden">
        {assignments.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-ink-500">
            No courses have been assigned to you yet.
          </div>
        ) : (
          <div className="divide-y divide-ink-100">
            {assignments.map((assignment) => {
              const status = getStatusMeta(assignment.status);
              const StatusIcon = status.icon;

              return (
                <button
                  key={assignment.id}
                  type="button"
                  onClick={() => openAssignment(assignment.id)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-ink-50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <GraduationCap className="h-5 w-5" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-ink-900">
                        {assignment.title}
                      </p>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${status.className}`}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {[
                        assignment.difficulty,
                        assignment.estimated_duration_minutes
                          ? `${assignment.estimated_duration_minutes} min`
                          : null,
                        assignment.due_date
                          ? `Due ${formatDate(assignment.due_date)}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" - ")}
                    </p>
                    <div className="mt-2 max-w-xs">
                      <ProgressBar value={assignment.progress_percentage} />
                    </div>
                  </div>

                  <span className="shrink-0 text-sm font-semibold text-ink-900">
                    {assignment.progress_percentage}%
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selectedId && (
        <CourseModal
          loading={detailLoading}
          error={detailError}
          detail={detail}
          updating={updating}
          onClose={closeAssignment}
          onBumpProgress={bumpProgress}
          onMarkComplete={handleMarkComplete}
        />
      )}
    </div>
  );
}

function CourseModal({
  loading,
  error,
  detail,
  updating,
  onClose,
  onBumpProgress,
  onMarkComplete,
}) {
  const status = getStatusMeta(detail?.status);
  const StatusIcon = status.icon;
  const isComplete = detail?.status === "completed";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-ink-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink-950">
              {detail?.course?.title || "Course Details"}
            </h2>
            {detail?.course?.difficulty && (
              <p className="mt-0.5 text-xs capitalize text-ink-500">
                {detail.course.difficulty}
                {detail.course.estimated_duration_minutes
                  ? ` - ${detail.course.estimated_duration_minutes} min`
                  : ""}
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

          {!loading && detail && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-ink-50 px-4 py-3">
                <div className="flex-1">
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${status.className}`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </span>
                    <span className="font-semibold text-ink-950">
                      {detail.progress.progress_percentage}%
                    </span>
                  </div>
                  <ProgressBar value={detail.progress.progress_percentage} />
                  {detail.assignment?.due_date && (
                    <p className="mt-2 text-xs text-ink-500">
                      Due {formatDate(detail.assignment.due_date)}
                    </p>
                  )}
                </div>
              </div>

              {!isComplete && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onBumpProgress(25)}
                    disabled={updating}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-700 transition hover:bg-ink-50 disabled:opacity-60"
                  >
                    {updating && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    +25% progress
                  </button>

                  <button
                    type="button"
                    onClick={onMarkComplete}
                    disabled={updating}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-800 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-900 disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Mark Complete
                  </button>
                </div>
              )}

              {detail.course?.description && (
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-400">
                    About this course
                  </p>
                  <p className="text-sm text-ink-700">
                    {detail.course.description}
                  </p>
                </div>
              )}

              {Array.isArray(detail.course?.modules) &&
                detail.course.modules.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">
                      Course Content
                    </p>

                    <div className="space-y-3">
                      {detail.course.modules.map((module) => (
                        <div
                          key={module.id}
                          className="rounded-lg border border-ink-100 p-3"
                        >
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 shrink-0 text-brand-600" />
                            <p className="text-sm font-medium text-ink-900">
                              {module.title}
                            </p>
                          </div>

                          {Array.isArray(module.lessons) &&
                            module.lessons.length > 0 && (
                              <ul className="mt-2 space-y-1 pl-6 text-xs text-ink-500">
                                {module.lessons.map((lesson) => (
                                  <li
                                    key={lesson.id}
                                    className="list-disc"
                                  >
                                    {lesson.title}
                                  </li>
                                ))}
                              </ul>
                            )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
