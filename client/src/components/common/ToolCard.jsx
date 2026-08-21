import { useNavigate } from "react-router-dom";
import { Wrench, ArrowRight } from "lucide-react";
import StatusBadge from "./StatusBadge";

/**
 * Renders a single Problem → Tool pairing.
 *
 * Every tool is defined in config/categories.js.
 * Implemented tools can provide a route through tool.route.
 * Tools without a route remain on the roadmap.
 */
export default function ToolCard({
  problem,
  tool,
  subcategoryName,
}) {
  const navigate = useNavigate();

  const isAvailable =
    tool?.status === "available" && tool?.route;

  const handleOpenTool = () => {
    if (!isAvailable) return;

    navigate(tool.route);
  };

  return (
    <div className="card flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink-600">
            <Wrench
              className="h-4 w-4"
              strokeWidth={1.75}
            />
          </span>

          <span className="text-xs font-medium uppercase tracking-wide text-ink-400">
            {subcategoryName}
          </span>
        </div>

        <StatusBadge status={tool.status} />
      </div>

      <div>
        <h4 className="text-sm font-semibold text-ink-900">
          {tool.name}
        </h4>

        <p className="mt-0.5 text-sm text-brand-700">
          {tool.tagline}
        </p>
      </div>

      <div className="rounded-lg bg-canvas px-3 py-2.5">
        <p className="text-xs font-medium text-ink-400">
          HR problem
        </p>

        <p className="mt-1 text-sm leading-relaxed text-ink-700">
          {problem}
        </p>
      </div>

      {isAvailable ? (
        <button
          type="button"
          onClick={handleOpenTool}
          className="mt-auto flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          Open tool
          <ArrowRight className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          disabled
          className="mt-auto w-full cursor-not-allowed rounded-lg border border-ink-100 bg-ink-50 py-2 text-sm font-medium text-ink-400"
          title="This tool is on the roadmap and not built yet"
        >
          Coming soon
        </button>
      )}
    </div>
  );
}