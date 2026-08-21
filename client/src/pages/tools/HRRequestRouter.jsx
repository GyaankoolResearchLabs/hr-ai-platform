import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardList,
  Send,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import api from "../../lib/api";

const EXAMPLE_REQUESTS = [
  "I need my experience certificate urgently because I am joining my new company tomorrow.",
  "I have a complaint about harassment from my team lead.",
  "My salary for last month has not been credited yet.",
  "I would like to apply for 5 days of annual leave next week.",
  "I need an address proof letter from HR for my bank account opening.",
];

export default function HRRequestRouter() {
  const navigate = useNavigate();

  const [requestText, setRequestText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleBack = () => {
    navigate(-1);
  };

  const handleClassify = async () => {
    const text = requestText.trim();

    if (!text) {
      return;
    }

    setLoading(true);
    setResult(null);
    setError("");
    setSubmitted(false);

    try {
      /*
       * Use the AI assistant endpoint to classify the request.
       * We send a structured prompt asking for JSON classification output.
       */
      const prompt = `You are an HR routing specialist. Classify the following employee HR request into a routing decision.

Employee Request:
"${text}"

Respond with ONLY a valid JSON object (no markdown, no explanation) in this exact format:
{
  "category": "<one of: Leave & Attendance | Payroll & Compensation | Employee Documents | Employee Relations | Recruitment | IT & Access | General HR>",
  "owner": "<responsible team or role>",
  "priority": "<Low | Normal | High | Urgent>",
  "reasoning": "<one sentence explanation of why this category and priority>",
  "suggested_actions": ["<action 1>", "<action 2>"]
}`;

      const response = await api.post("/ai/assistant", {
        prompt,
        context: { categoryId: "hr-routing" },
      });

      const reply = response?.data?.reply || "";

      // Try to parse JSON from the AI response
      let parsed = null;

      try {
        // Strip any possible markdown fences
        const cleaned = reply
          .replace(/```json\n?/gi, "")
          .replace(/```\n?/gi, "")
          .trim();

        parsed = JSON.parse(cleaned);
      } catch {
        // If the AI did not return valid JSON, extract key fields from text
        parsed = {
          category: extractField(reply, "category") || "General HR",
          owner: extractField(reply, "owner") || "HR Operations",
          priority: extractField(reply, "priority") || "Normal",
          reasoning:
            "Classification based on AI analysis of your request.",
          suggested_actions: [],
        };
      }

      setResult(parsed);
    } catch (err) {
      console.error("HR request classification failed:", err);
      setError(
        err?.response?.data?.message ||
          err.message ||
          "Classification failed. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (!result || submitting) return;

    setSubmitting(true);

    try {
      await api.post("/hr-requests", {
        title: requestText.slice(0, 120),
        description: requestText,
        category: result.category,
        priority: result.priority?.toLowerCase(),
      });

      setSubmitted(true);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err.message ||
          "Could not submit the request. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setRequestText("");
    setResult(null);
    setError("");
    setSubmitted(false);
  };

  return (
    <div className="max-w-5xl">
      {/* Back */}
      <button
        type="button"
        onClick={handleBack}
        className="mb-6 inline-flex items-center gap-2 text-sm text-ink-500 transition hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* Header */}
      <div className="mb-8 flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <ClipboardList
            className="h-6 w-6"
            strokeWidth={1.75}
          />
        </span>

        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-950">
            HR Request Router
          </h1>

          <p className="mt-1 text-sm text-ink-500">
            AI-powered classification and routing of employee HR requests.
          </p>
        </div>
      </div>

      {/* Main input card */}
      <div className="card p-6">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-ink-900">
            Submit an HR request
          </h2>

          <p className="mt-1 text-sm text-ink-500">
            Describe the employee's request in plain language. The AI will
            classify it, recommend priority, and identify the responsible HR
            team.
          </p>
        </div>

        <label className="mb-2 block text-sm font-medium text-ink-700">
          Employee request
        </label>

        <textarea
          value={requestText}
          onChange={(e) => setRequestText(e.target.value)}
          placeholder="Example: I need my experience certificate urgently because I am joining my new company tomorrow."
          rows={5}
          className="w-full resize-none rounded-lg border border-ink-200 bg-white px-4 py-3 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />

        {/* Suggestion chips */}
        {!requestText && (
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLE_REQUESTS.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setRequestText(example)}
                className="rounded-full border border-ink-200 bg-canvas px-3 py-1 text-xs text-ink-600 transition hover:border-brand-300 hover:text-brand-700"
              >
                {example.length > 55
                  ? `${example.slice(0, 55)}…`
                  : example}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleClassify}
            disabled={loading || !requestText.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {loading ? "Classifying…" : "Classify & Route"}
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-ink-200 bg-white px-5 py-2.5 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </div>

      {/* Result */}
      {result && !submitted && (
        <div className="card mt-6 overflow-hidden">
          <div className="border-b border-ink-100 px-6 py-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />

              <h2 className="text-base font-semibold text-ink-900">
                Routing recommendation
              </h2>
            </div>

            <p className="mt-1 text-sm text-ink-500">
              Review the AI recommendation before routing the request.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-3">
            <div className="rounded-lg bg-canvas p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                Category
              </p>

              <p className="mt-2 text-sm font-semibold text-ink-900">
                {result.category}
              </p>
            </div>

            <div className="rounded-lg bg-canvas p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                Responsible owner
              </p>

              <p className="mt-2 text-sm font-semibold text-ink-900">
                {result.owner}
              </p>
            </div>

            <div className="rounded-lg bg-canvas p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                Priority
              </p>

              <p className="mt-2 text-sm font-semibold text-ink-900">
                {result.priority}
              </p>
            </div>
          </div>

          {result.reasoning && (
            <div className="border-t border-ink-100 px-6 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400 mb-1">
                AI reasoning
              </p>
              <p className="text-sm text-ink-700">{result.reasoning}</p>
            </div>
          )}

          {Array.isArray(result.suggested_actions) &&
            result.suggested_actions.length > 0 && (
              <div className="border-t border-ink-100 px-6 py-4">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-400 mb-2">
                  Suggested actions
                </p>
                <ul className="space-y-1">
                  {result.suggested_actions.map((action, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-ink-700"
                    >
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}

          <div className="flex flex-wrap items-center gap-3 border-t border-ink-100 px-6 py-4">
            <button
              type="button"
              onClick={handleSubmitRequest}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-800 disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {submitting ? "Submitting…" : "Confirm & Submit Request"}
            </button>

            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-xs leading-relaxed text-ink-500">
                Review the recommendation before confirming. Submitting will
                create the request in the system.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Submitted confirmation */}
      {submitted && (
        <div className="card mt-6 overflow-hidden border-emerald-200 bg-emerald-50">
          <div className="p-6 flex items-start gap-4">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
            <div>
              <h3 className="text-base font-semibold text-emerald-900">
                Request submitted successfully
              </h3>
              <p className="mt-1 text-sm text-emerald-700">
                The request has been logged in the system under{" "}
                <strong>{result?.category}</strong> with{" "}
                <strong>{result?.priority}</strong> priority.
              </p>
              <button
                type="button"
                onClick={handleReset}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-50"
              >
                <RotateCcw className="h-4 w-4" />
                Route another request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper to extract field from unstructured AI text ───────────────────────
function extractField(text, field) {
  const regex = new RegExp(
    `"?${field}"?\\s*:\\s*"?([^",\\n}]+)"?`,
    "i"
  );
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}