import { Link, useParams, Navigate } from "react-router-dom";
import { ChevronLeft, ArrowRight } from "lucide-react";
import { getCategoryById, getToolCount } from "../config/categories";
import { getIcon } from "../lib/icons";
import ToolCard from "../components/common/ToolCard";

export default function CategoryDetail() {
  const { categoryId } = useParams();
  const category = getCategoryById(categoryId);

  if (!category) {
    return <Navigate to="/app/dashboard" replace />;
  }

  const Icon = getIcon(category.icon);
  const toolCount = getToolCount(category);

  return (
    <div>
      {/* =====================================================
          BACK
      ===================================================== */}

      <Link
        to="/app/dashboard"
        className="mb-6 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800"
      >
        <ChevronLeft className="h-4 w-4" />
        All categories
      </Link>

      {/* =====================================================
          CATEGORY HEADER
      ===================================================== */}

      <div className="mb-8 flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <Icon
            className="h-6 w-6"
            strokeWidth={1.75}
          />
        </span>

        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-950">
            {category.name}
          </h1>

          <p className="mt-1 text-sm text-ink-500">
            {category.tagline}
          </p>

          <p className="mt-1 text-xs text-ink-400">
            {category.subcategories.length} subcategories ·{" "}
            {toolCount} tools mapped to documented problems
          </p>
        </div>
      </div>

      {/* =====================================================
          SUBCATEGORIES
      ===================================================== */}

      <div className="space-y-10">
        {category.subcategories.map((sub) => (
          <section key={sub.id}>
            {/* =================================================
                SUBCATEGORY HEADER
            ================================================= */}

            <div className="mb-4">
              <h2 className="text-base font-semibold text-ink-900">
                {sub.name}
              </h2>

              {sub.description && (
                <p className="mt-0.5 text-sm text-ink-500">
                  {sub.description}
                </p>
              )}
            </div>

            {/* =================================================
                TOOLS
            ================================================= */}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sub.problems.map((p) => {
                /*
                 * Integration Hub is now an actual tool.
                 *
                 * The old ToolCard displays "Planned /
                 * Coming soon" for this tool, so we handle
                 * this specific tool directly here.
                 */
                const isIntegrationHub =
                  String(p.tool || "").trim().toLowerCase() ===
                  "integration hub";

                if (isIntegrationHub) {
                  return (
                    <Link
                      key={p.id}
                      to="/app/tools/integration-hub"
                      className="group block rounded-xl border border-ink-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
                    >
                      {/* =================================================
                          TOOL HEADER
                      ================================================= */}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                            <span className="text-sm">
                              ↗
                            </span>
                          </span>

                          <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
                            Integration
                          </span>
                        </div>

                        <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                          Active
                        </span>
                      </div>

                      {/* =================================================
                          TOOL NAME
                      ================================================= */}

                      <h3 className="mt-4 text-sm font-semibold text-ink-950">
                        {p.tool}
                      </h3>

                      {/* =================================================
                          TOOL DESCRIPTION
                      ================================================= */}

                      <p className="mt-1 text-sm text-brand-700">
                        One place to connect HR systems together
                      </p>

                      {/* =================================================
                          HR PROBLEM
                      ================================================= */}

                      <div className="mt-4 rounded-lg bg-ink-50 p-3">
                        <p className="text-xs font-medium text-ink-400">
                          HR problem
                        </p>

                        <p className="mt-1 text-sm leading-5 text-ink-700">
                          {p.problem}
                        </p>
                      </div>

                      {/* =================================================
                          OPEN BUTTON
                      ================================================= */}

                      <div className="mt-4 flex items-center justify-between rounded-lg border border-brand-100 bg-brand-50 px-3 py-2.5">
                        <span className="text-sm font-medium text-brand-700">
                          Open Integration Hub
                        </span>

                        <ArrowRight
                          className="h-4 w-4 text-brand-700 transition-transform duration-200 group-hover:translate-x-1"
                        />
                      </div>
                    </Link>
                  );
                }

                /*
                 * Every other existing tool continues using
                 * the existing ToolCard exactly as before.
                 */
                return (
                  <ToolCard
                    key={p.id}
                    problem={p.problem}
                    tool={p.tool}
                    subcategoryName={sub.name}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}