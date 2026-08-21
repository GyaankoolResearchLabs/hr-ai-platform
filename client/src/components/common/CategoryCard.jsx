import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { getIcon } from "../../lib/icons";

export default function CategoryCard({ category }) {
  const Icon = getIcon(category.icon);

  return (
    <Link
      to={`/app/categories/${category.id}`}
      className="card card-hover group flex flex-col gap-4 p-5"
    >
      <div className="flex items-start justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <ArrowRight className="h-4 w-4 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-ink-900">{category.name}</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-500">{category.tagline}</p>
      </div>
      <div className="mt-auto flex items-center gap-3 pt-1 text-xs text-ink-400">
        <span>{category.subcategoryCount} subcategories</span>
        <span className="h-1 w-1 rounded-full bg-ink-200" />
        <span>{category.toolCount} tools mapped</span>
      </div>
    </Link>
  );
}
