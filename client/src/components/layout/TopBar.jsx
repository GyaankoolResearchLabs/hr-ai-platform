import { LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function TopBar() {
  const { organization, subscription, subscriptionActive, user, signOut } = useAuth();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-ink-100 bg-surface px-6">
      <div>
        <p className="text-sm font-semibold text-ink-900">{organization?.name || "Your organization"}</p>
        <div className="flex items-center gap-1.5 text-xs text-ink-400">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              subscriptionActive ? "bg-brand-500" : "bg-amber-glow"
            }`}
          />
          {subscriptionActive
            ? `Subscription active${subscription?.plan ? ` · ${subscription.plan}` : ""}`
            : "Subscription inactive"}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-ink-600">{user?.email}</span>
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-ink-500 transition hover:bg-ink-50 hover:text-ink-900"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
          Sign out
        </button>
      </div>
    </header>
  );
}
