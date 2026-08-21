import { useMemo } from "react";
import { getCategorySummary, getAllTools } from "../config/categories";
import CategoryCard from "../components/common/CategoryCard";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const categories = useMemo(() => getCategorySummary(), []);
  const totalTools = useMemo(() => getAllTools().length, []);
  const { user, organization } = useAuth();
  const firstName = user?.user_metadata?.full_name?.split(" ")[0];

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-ink-950">
          {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {organization?.name ? `${organization.name} · ` : ""}
          {totalTools} tools mapped across {categories.length} HR categories.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <CategoryCard key={category.id} category={category} />
        ))}
      </div>
    </div>
  );
}
