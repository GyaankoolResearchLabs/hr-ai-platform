import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Star,
  Target,
} from "lucide-react";

import employeePerformanceService from "../services/employeePerformanceService";

/*
|--------------------------------------------------------------------------
| STATUS DISPLAY
|--------------------------------------------------------------------------
| Mirrors ReviewCycleManager.jsx's statusLabel()/statusClass() so a
| review reads identically whether HR or the employee is looking at it.
|--------------------------------------------------------------------------
*/

function reviewStatusLabel(status) {
  return (
    {
      pending: "Pending",
      in_progress: "In progress",
      submitted: "Submitted",
      acknowledged: "Acknowledged",
      completed: "Completed",
    }[status] ||
    status ||
    "Unknown"
  );
}

function reviewStatusClass(status) {
  const map = {
    pending: "border-ink-200 bg-ink-50 text-ink-600",
    in_progress: "border-blue-200 bg-blue-50 text-blue-700",
    submitted: "border-amber-200 bg-amber-50 text-amber-700",
    acknowledged: "border-emerald-200 bg-emerald-50 text-emerald-700",
    completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  return map[status] || "border-ink-200 bg-ink-50 text-ink-600";
}

function goalStatusLabel(status) {
  return (
    {
      not_started: "Not started",
      in_progress: "In progress",
      completed: "Completed",
    }[status] ||
    status ||
    "Unknown"
  );
}

function goalStatusClass(status) {
  const map = {
    not_started: "border-ink-200 bg-ink-50 text-ink-600",
    in_progress: "border-blue-200 bg-blue-50 text-blue-700",
    completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  return map[status] || "border-ink-200 bg-ink-50 text-ink-600";
}

function reviewTypeLabel(type) {
  return (
    {
      annual: "Annual review",
      mid_year: "Mid-year review",
      quarterly: "Quarterly review",
      probation: "Probation review",
    }[type] ||
    type ||
    "Review"
  );
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

function RatingStars({ rating }) {
  if (rating === null || rating === undefined) {
    return <span className="text-sm text-ink-500">Not rated</span>;
  }

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={`h-4 w-4 ${
            value <= Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "text-ink-200"
          }`}
        />
      ))}
      <span className="ml-1 text-sm font-medium text-ink-700">
        {rating}/5
      </span>
    </div>
  );
}

export default function EmployeePerformance() {
  const [goals, setGoals] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingGoalId, setUpdatingGoalId] = useState(null);
  const [acknowledgingId, setAcknowledgingId] = useState(null);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [goalsData, reviewsData] = await Promise.all([
        employeePerformanceService.listGoals(),
        employeePerformanceService.listReviews(),
      ]);

      setGoals(goalsData);
      setReviews(reviewsData);
    } catch (err) {
      console.error("Employee performance load error:", err);

      setError(
        err?.response?.data?.message ||
          "Unable to load your performance data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function bumpGoalProgress(goal, amount) {
    const nextValue = Math.min(100, Math.max(0, goal.progress + amount));

    try {
      setUpdatingGoalId(goal.id);

      const updated = await employeePerformanceService.updateGoalProgress(
        goal.id,
        nextValue
      );

      setGoals((current) =>
        current.map((item) => (item.id === goal.id ? updated : item))
      );
    } catch (err) {
      console.error("Goal progress update error:", err);

      setError(
        err?.response?.data?.message || "Unable to update goal progress."
      );
    } finally {
      setUpdatingGoalId(null);
    }
  }

  async function acknowledgeReview(review) {
    try {
      setAcknowledgingId(review.id);

      const updated = await employeePerformanceService.acknowledgeReview(
        review.id
      );

      setReviews((current) =>
        current.map((item) => (item.id === review.id ? updated : item))
      );
    } catch (err) {
      console.error("Review acknowledge error:", err);

      setError(
        err?.response?.data?.message || "Unable to acknowledge this review."
      );
    } finally {
      setAcknowledgingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-ink-500">
          <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
          Loading your performance data...
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
            Performance
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Your goals and performance reviews.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
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

      {/* =================================================
          GOALS
      ================================================= */}

      <section className="card mb-6 overflow-hidden">
        <div className="border-b border-ink-100 px-5 py-4">
          <h2 className="text-base font-semibold text-ink-950">
            My Goals
          </h2>
        </div>

        {goals.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-ink-500">
            No goals have been set for you yet.
          </div>
        ) : (
          <div className="divide-y divide-ink-100">
            {goals.map((goal) => {
              const isUpdating = updatingGoalId === goal.id;
              const isComplete = goal.status === "completed";

              return (
                <div key={goal.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                          <Target className="h-4 w-4" />
                        </span>
                        <p className="text-sm font-medium text-ink-900">
                          {goal.title}
                        </p>
                        <span
                          className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${goalStatusClass(
                            goal.status
                          )}`}
                        >
                          {goalStatusLabel(goal.status)}
                        </span>
                      </div>

                      {goal.description && (
                        <p className="mt-1.5 pl-11 text-xs text-ink-500">
                          {goal.description}
                        </p>
                      )}

                      <p className="mt-1 pl-11 text-xs text-ink-400">
                        {[
                          goal.category,
                          goal.due_date
                            ? `Due ${formatDate(goal.due_date)}`
                            : null,
                          goal.target_value
                            ? `Target: ${goal.target_value}${
                                goal.unit ? ` ${goal.unit}` : ""
                              }`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" - ")}
                      </p>

                      <div className="mt-3 max-w-sm pl-11">
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-ink-500">Progress</span>
                          <span className="font-semibold text-ink-900">
                            {goal.progress}%
                          </span>
                        </div>
                        <ProgressBar value={goal.progress} />
                      </div>
                    </div>

                    {!isComplete && (
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => bumpGoalProgress(goal, 10)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-700 transition hover:bg-ink-50 disabled:opacity-60"
                        >
                          {isUpdating && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          )}
                          +10% progress
                        </button>

                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => bumpGoalProgress(goal, 100)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-800 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-900 disabled:opacity-60"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Mark complete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* =================================================
          REVIEWS
      ================================================= */}

      <section className="card overflow-hidden">
        <div className="border-b border-ink-100 px-5 py-4">
          <h2 className="text-base font-semibold text-ink-950">
            My Reviews
          </h2>
        </div>

        {reviews.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-ink-500">
            No performance reviews yet.
          </div>
        ) : (
          <div className="divide-y divide-ink-100">
            {reviews.map((review) => (
              <div key={review.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-ink-900">
                        {review.cycle_title || "Performance review"}
                      </p>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${reviewStatusClass(
                          review.status
                        )}`}
                      >
                        {reviewStatusLabel(review.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink-500">
                      {[
                        reviewTypeLabel(review.cycle_review_type),
                        review.cycle_due_date
                          ? `Due ${formatDate(review.cycle_due_date)}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" - ")}
                    </p>
                  </div>

                  {review.status === "submitted" && (
                    <button
                      type="button"
                      disabled={acknowledgingId === review.id}
                      onClick={() => acknowledgeReview(review)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60"
                    >
                      {acknowledgingId === review.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      )}
                      Acknowledge
                    </button>
                  )}
                </div>

                {["submitted", "acknowledged", "completed"].includes(
                  review.status
                ) && (
                  <div className="mt-3 rounded-xl bg-canvas p-4">
                    <RatingStars rating={review.rating} />

                    {review.comments && (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-600">
                        {review.comments}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
