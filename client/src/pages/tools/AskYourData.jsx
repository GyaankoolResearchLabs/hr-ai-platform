import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  Users,
} from "lucide-react";

import api from "../../lib/api";

const SUGGESTIONS = [
  "How many employees do we have?",
  "Which department has the most employees?",
  "What is our attendance rate?",
  "How many people are on leave?",
  "Show me the workforce breakdown.",
  "How many performance reviews are completed?",
];

function formatValue(value) {
  if (value === null || value === undefined) {
    return "—";
  }

  if (typeof value === "number") {
    return value.toLocaleString();
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "object") {
    if (Array.isArray(value)) {
      return value.join(", ");
    }

    if (value.department) {
      return value.department;
    }

    if (value.name) {
      return value.name;
    }

    return JSON.stringify(value);
  }

  return String(value);
}

function formatLabel(key) {
  return String(key)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function MetricCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
        <Icon size={16} />
        <span>{label}</span>
      </div>

      <div className="text-2xl font-semibold text-slate-900">
        {formatValue(value)}
      </div>
    </div>
  );
}

function AnswerData({ result }) {
  if (!result) {
    return null;
  }

  if (
    result.type === "table" &&
    Array.isArray(result.data)
  ) {
    return (
      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 font-medium text-slate-800">
          Department breakdown
        </div>

        <div className="divide-y divide-slate-100">
          {result.data.map((item, index) => (
            <div
              key={`${item?.department || "department"}-${index}`}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div>
                <div className="font-medium text-slate-800">
                  {formatValue(item?.department)}
                </div>

                <div className="text-xs text-slate-500">
                  {formatValue(item?.active)} active
                </div>
              </div>

              <div className="font-semibold text-slate-900">
                {formatValue(item?.headcount)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (
    result.type === "attendance" &&
    result.data
  ) {
    return (
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          icon={CheckCircle2}
          label="Present"
          value={result.data.present}
        />

        <MetricCard
          icon={Clock3}
          label="Absent"
          value={result.data.absent}
        />

        <MetricCard
          icon={Users}
          label="On leave"
          value={result.data.leave}
        />

        <MetricCard
          icon={BarChart3}
          label="Attendance"
          value={
            result.data.attendanceRate !== undefined
              ? `${result.data.attendanceRate}%`
              : "—"
          }
        />
      </div>
    );
  }

  if (
    result.type === "leave" &&
    result.data
  ) {
    return (
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          icon={Database}
          label="Total"
          value={result.data.total}
        />

        <MetricCard
          icon={Clock3}
          label="Pending"
          value={result.data.pending}
        />

        <MetricCard
          icon={CheckCircle2}
          label="Approved"
          value={result.data.approved}
        />

        <MetricCard
          icon={BarChart3}
          label="Rejected"
          value={result.data.rejected}
        />
      </div>
    );
  }

  if (
    result.type === "performance" &&
    result.data
  ) {
    return (
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MetricCard
          icon={Database}
          label="Total reviews"
          value={result.data.total}
        />

        <MetricCard
          icon={CheckCircle2}
          label="Completed"
          value={result.data.completed}
        />

        <MetricCard
          icon={BarChart3}
          label="Completion"
          value={
            result.data.completionRate !== undefined
              ? `${result.data.completionRate}%`
              : "—"
          }
        />
      </div>
    );
  }

  if (
    result.type === "metric" &&
    result.data
  ) {
    return (
      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
        {Object.entries(result.data).map(
          ([key, value]) => (
            <div
              key={key}
              className="flex items-center justify-between gap-4 border-b border-slate-200 py-3 last:border-0"
            >
              <span className="text-sm text-slate-500">
                {formatLabel(key)}
              </span>

              <span className="max-w-[60%] break-words text-right font-medium text-slate-900">
                {formatValue(value)}
              </span>
            </div>
          )
        )}
      </div>
    );
  }

  if (Array.isArray(result.data)) {
    return (
      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
        {result.data.map((item, index) => (
          <div
            key={index}
            className="border-b border-slate-100 px-4 py-3 last:border-0"
          >
            {typeof item === "object" ? (
              Object.entries(item).map(
                ([key, value]) => (
                  <div
                    key={key}
                    className="flex justify-between gap-4 py-1"
                  >
                    <span className="text-sm text-slate-500">
                      {formatLabel(key)}
                    </span>

                    <span className="text-right text-sm font-medium text-slate-900">
                      {formatValue(value)}
                    </span>
                  </div>
                )
              )
            ) : (
              <span className="text-sm text-slate-700">
                {formatValue(item)}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (
    typeof result.data === "object" &&
    result.data !== null
  ) {
    return (
      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
        {Object.entries(result.data).map(
          ([key, value]) => (
            <div
              key={key}
              className="flex items-center justify-between gap-4 border-b border-slate-200 py-3 last:border-0"
            >
              <span className="text-sm text-slate-500">
                {formatLabel(key)}
              </span>

              <span className="max-w-[60%] break-words text-right font-medium text-slate-900">
                {formatValue(value)}
              </span>
            </div>
          )
        )}
      </div>
    );
  }

  return null;
}

export default function WorkforceMetrics({ onBack }) {
  const navigate = useNavigate();

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);

  const inputRef = useRef(null);

  const hasHistory = history.length > 0;

  const quickQuestions = useMemo(
    () => SUGGESTIONS,
    []
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleBack() {
    if (typeof onBack === "function") {
      onBack();
      return;
    }

    /*
     * If this page was opened from the category page,
     * go back to that page.
     *
     * If the user opened this page directly or refreshed,
     * safely return to the dashboard.
     */
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/app/dashboard", {
        replace: true,
      });
    }
  }

  async function askQuestion(value = question) {
    const trimmed = String(value || "").trim();

    if (!trimmed || loading) {
      return;
    }

    setLoading(true);
    setError("");
    setAnswer(null);

    try {
      const response = await api.post(
        "/workforce-query",
        {
          question: trimmed,
        }
      );

      const data = response?.data;

      const result = data?.result || null;

      setAnswer(result);

      setHistory((previous) => [
        {
          question: trimmed,
          result,
          generatedAt:
            data?.generatedAt ||
            new Date().toISOString(),
        },
        ...previous,
      ].slice(0, 10));

      setQuestion("");
    } catch (requestError) {
      console.error(
        "[AskYourData]",
        requestError
      );

      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Unable to answer the question."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    askQuestion();
  }

  function handleSuggestion(suggestion) {
    setQuestion(suggestion);
    askQuestion(suggestion);
  }

  function clearConversation() {
    setAnswer(null);
    setHistory([]);
    setError("");
    setQuestion("");

    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }

  return (
    <div className="min-h-full bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">

        {/* TOP BAR */}
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 rounded-lg border border-brand-600 bg-white px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-brand-50 active:scale-[0.98]"
          >
            <ArrowLeft
              className="h-4 w-4"
              strokeWidth={2}
            />
            Back
          </button>

          {hasHistory && (
            <button
              type="button"
              onClick={clearConversation}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:bg-white hover:text-slate-800"
            >
              <RefreshCw size={15} />
              Clear
            </button>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">

          {/* MAIN */}
          <main>

            {/* HEADER */}
            <div className="mb-6">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700">
                <Brain size={14} />
                ASK YOUR DATA
              </div>

              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Ask-Your-Data HR Query Assistant
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
                Ask questions in plain language and get answers directly from your organization's workforce data.
              </p>
            </div>

            {/* QUESTION FORM */}
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">

                <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                  <MessageSquare size={19} />
                </div>

                <div className="min-w-0 flex-1">

                  <label
                    htmlFor="workforce-question"
                    className="mb-2 block text-sm font-medium text-slate-800"
                  >
                    Ask a workforce question
                  </label>

                  <div className="flex flex-col gap-3 sm:flex-row">

                    <input
                      ref={inputRef}
                      id="workforce-question"
                      value={question}
                      onChange={(event) =>
                        setQuestion(event.target.value)
                      }
                      placeholder="e.g. How many employees are in Engineering?"
                      className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                      disabled={loading}
                    />

                    <button
                      type="submit"
                      disabled={
                        loading ||
                        !question.trim()
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loading ? (
                        <Loader2
                          size={17}
                          className="animate-spin"
                        />
                      ) : (
                        <Send size={17} />
                      )}

                      {loading
                        ? "Analyzing"
                        : "Ask"}
                    </button>

                  </div>
                </div>
              </div>
            </form>

            {/* ERROR */}
            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* EMPTY STATE */}
            {!answer && !loading && (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">

                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <Search size={22} />
                </div>

                <h2 className="font-medium text-slate-900">
                  Ask anything about your workforce
                </h2>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  The assistant will calculate the answer from your live HR data.
                </p>

                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {quickQuestions
                    .slice(0, 4)
                    .map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() =>
                          handleSuggestion(
                            suggestion
                          )
                        }
                        className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
                      >
                        {suggestion}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* LOADING */}
            {loading && (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex items-center gap-3">

                  <Loader2
                    size={20}
                    className="animate-spin text-teal-600"
                  />

                  <div>
                    <div className="font-medium text-slate-900">
                      Analyzing workforce data
                    </div>

                    <div className="text-sm text-slate-500">
                      Querying live HR records...
                    </div>
                  </div>
                </div>

                <div className="mt-5 h-3 animate-pulse rounded-full bg-slate-100" />

                <div className="mt-3 h-3 w-3/4 animate-pulse rounded-full bg-slate-100" />
              </div>
            )}

            {/* ANSWER */}
            {answer && !loading && (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                <div className="flex items-start gap-3">

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                    <CheckCircle2 size={19} />
                  </div>

                  <div className="min-w-0">
                    <div className="text-xs font-medium uppercase tracking-wide text-teal-600">
                      Answer
                    </div>

                    <h2 className="mt-1 text-lg font-semibold text-slate-900">
                      {formatValue(answer.title)}
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {formatValue(answer.answer)}
                    </p>
                  </div>

                </div>

                <AnswerData result={answer} />
              </div>
            )}
          </main>

          {/* SIDEBAR */}
          <aside>

            {/* DATA SOURCES */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

              <div className="flex items-center gap-2">
                <Database
                  size={17}
                  className="text-teal-600"
                />

                <h2 className="font-semibold text-slate-900">
                  Live workforce data
                </h2>
              </div>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Answers are calculated from your organization's HR records rather than static demo values.
              </p>

              <div className="mt-5 space-y-2">
                {[
                  "Employees",
                  "Attendance",
                  "Leave requests",
                  "Performance reviews",
                ].map((source) => (
                  <div
                    key={source}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5"
                  >
                    <span className="text-sm text-slate-600">
                      {source}
                    </span>

                    <CheckCircle2
                      size={15}
                      className="text-teal-600"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* QUICK QUESTIONS */}
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-3 text-sm font-semibold text-slate-900">
                Try asking
              </div>

              <div className="space-y-1">
                {quickQuestions.map(
                  (suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() =>
                        handleSuggestion(
                          suggestion
                        )
                      }
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                    >
                      <span>{suggestion}</span>

                      <ChevronRight size={15} />
                    </button>
                  )
                )}
              </div>
            </div>

            {/* HISTORY */}
            {history.length > 0 && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">

                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">
                    Recent questions
                  </div>

                  <span className="text-xs text-slate-400">
                    {history.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {history.slice(0, 5).map(
                    (item, index) => (
                      <button
                        key={`${item.question}-${index}`}
                        type="button"
                        onClick={() =>
                          askQuestion(
                            item.question
                          )
                        }
                        className="w-full rounded-lg bg-slate-50 p-3 text-left text-xs text-slate-600 transition hover:bg-slate-100"
                      >
                        {item.question}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}