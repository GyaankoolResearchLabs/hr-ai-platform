import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardList,
  Send,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export default function HRRequestRouter() {
  const navigate = useNavigate();

  const [requestText, setRequestText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

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

    try {
      /*
       * Temporary local classification.
       *
       * We will connect this to the backend/AI routing service
       * after the UI flow is working.
       */

      const lowerText = text.toLowerCase();

      let category = "General HR";
      let owner = "HR Operations";
      let priority = "Normal";

      if (
        lowerText.includes("leave") ||
        lowerText.includes("vacation") ||
        lowerText.includes("holiday")
      ) {
        category = "Leave & Attendance";
        owner = "HR Operations";
      } else if (
        lowerText.includes("salary") ||
        lowerText.includes("payroll") ||
        lowerText.includes("payslip") ||
        lowerText.includes("salary slip")
      ) {
        category = "Payroll & Compensation";
        owner = "Payroll Team";
      } else if (
        lowerText.includes("resign") ||
        lowerText.includes("resignation") ||
        lowerText.includes("exit") ||
        lowerText.includes("notice period")
      ) {
        category = "Employee Relations";
        owner = "HR Manager";
      } else if (
        lowerText.includes("document") ||
        lowerText.includes("certificate") ||
        lowerText.includes("letter")
      ) {
        category = "Employee Documents";
        owner = "HR Operations";
      } else if (
        lowerText.includes("complaint") ||
        lowerText.includes("harassment") ||
        lowerText.includes("misconduct")
      ) {
        category = "Employee Relations";
        owner = "HR Manager";
        priority = "High";
      }

      if (
        lowerText.includes("urgent") ||
        lowerText.includes("immediately") ||
        lowerText.includes("today") ||
        lowerText.includes("asap")
      ) {
        priority = "High";
      }

      setResult({
        category,
        owner,
        priority,
        confidence: "Recommended",
      });
    } catch (error) {
      console.error("HR request classification failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setRequestText("");
    setResult(null);
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
            Classify incoming HR requests and route them to the right owner.
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
            Enter the employee's request. The system will recommend the
            appropriate HR category, priority, and responsible team.
          </p>
        </div>

        <label className="mb-2 block text-sm font-medium text-ink-700">
          Employee request
        </label>

        <textarea
          value={requestText}
          onChange={(e) => setRequestText(e.target.value)}
          placeholder="Example: I need my experience certificate urgently because I am joining my new company tomorrow."
          rows={6}
          className="w-full resize-none rounded-lg border border-ink-200 bg-white px-4 py-3 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleClassify}
            disabled={loading || !requestText.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />

            {loading ? "Classifying..." : "Classify & Route"}
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
      {result && (
        <div className="card mt-6 overflow-hidden">
          <div className="border-b border-ink-100 px-6 py-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />

              <h2 className="text-base font-semibold text-ink-900">
                Routing recommendation
              </h2>
            </div>

            <p className="mt-1 text-sm text-ink-500">
              Review the recommendation before routing the request.
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

          <div className="flex items-start gap-3 border-t border-ink-100 px-6 py-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />

            <p className="text-xs leading-relaxed text-ink-500">
              This is a routing recommendation. A human HR owner should
              review and confirm the classification before the request is
              finally routed.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}