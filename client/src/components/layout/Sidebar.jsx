import { NavLink } from "react-router-dom";
import {
  LayoutGrid,
  Sparkles,
  UserRound,
  Users,
  Settings as SettingsIcon,
} from "lucide-react";
import { CATEGORIES } from "../../config/categories";
import { getIcon } from "../../lib/icons";

const topLinks = [
  { to: "/app/dashboard", label: "Dashboard", Icon: LayoutGrid, end: true },
  { to: "/app/employee/dashboard", label: "Employee Portal", Icon: UserRound },
  { to: "/app/assistant", label: "AI Assistant", Icon: Sparkles },
  { to: "/app/employees", label: "Employees", Icon: Users },
];

const bottomLinks = [{ to: "/app/settings", label: "Settings", Icon: SettingsIcon }];

function linkClasses({ isActive }) {
  return [
    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
    isActive
      ? "bg-brand-50 text-brand-800 font-medium"
      : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
  ].join(" ");
}

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-ink-100 bg-surface">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-ink-100 px-5">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-800 text-sm font-semibold text-white">
          H
        </span>
        <span className="font-display text-sm font-semibold text-ink-900">HR AI Platform</span>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {topLinks.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClasses}>
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </div>

        <div>
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
            HR Categories
          </p>
          <div className="space-y-1">
            {CATEGORIES.map((category) => {
              const Icon = getIcon(category.icon);
              return (
                <NavLink
                  key={category.id}
                  to={`/app/categories/${category.id}`}
                  className={linkClasses}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                  <span className="truncate">{category.name}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      </nav>

      <div className="space-y-1 border-t border-ink-100 px-3 py-4">
        {bottomLinks.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} className={linkClasses}>
            <Icon className="h-4 w-4" strokeWidth={1.75} />
            {label}
          </NavLink>
        ))}
      </div>
    </aside>
  );
}
