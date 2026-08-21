import { Link, useParams, Navigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { getCategoryById, getToolCount } from "../config/categories";
import { getIcon } from "../lib/icons";
import ToolCard from "../components/common/ToolCard";

export default function CategoryDetail() {
  const { categoryId } = useParams();
  const category = getCategoryById(categoryId);

  if (!category) return <Navigate to="/app/dashboard" replace />;

  const Icon = getIcon(category.icon);
  const toolCount = getToolCount(category);

  return (
    <div>
      <Link
        to="/app/dashboard"
        className="mb-6 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800"
      >
        <ChevronLeft className="h-4 w-4" />
        All categories
      </Link>

      <div className="mb-8 flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <Icon className="h-6 w-6" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-950">{category.name}</h1>
          <p className="mt-1 text-sm text-ink-500">{category.tagline}</p>
          <p className="mt-1 text-xs text-ink-400">
            {category.subcategories.length} subcategories · {toolCount} tools mapped to
            documented problems
          </p>
        </div>
      </div>

      <div className="space-y-10">
        {category.subcategories.map((sub) => (
          <section key={sub.id}>
            <div className="mb-4">
              <h2 className="text-base font-semibold text-ink-900">{sub.name}</h2>
              {sub.description && (
                <p className="mt-0.5 text-sm text-ink-500">{sub.description}</p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sub.problems.map((p) => (
                <ToolCard
                  key={p.id}
                  problem={p.problem}
                  tool={p.tool}
                  subcategoryName={sub.name}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
