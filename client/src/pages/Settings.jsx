import { useAuth } from "../context/AuthContext";
import { CheckCircle2, Circle } from "lucide-react";

export default function Settings() {
  const { organization, subscription, subscriptionActive, user } = useAuth();

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-semibold text-ink-950">Settings</h1>
      <p className="mt-1 text-sm text-ink-500">Manage your organization, account, and subscription.</p>

      <div className="mt-8 space-y-6">
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-ink-900">Organization</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-500">Name</dt>
              <dd className="font-medium text-ink-900">{organization?.name || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">Industry</dt>
              <dd className="font-medium text-ink-900">{organization?.industry || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">Company size</dt>
              <dd className="font-medium text-ink-900">{organization?.size || "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-ink-900">Account</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-500">Email</dt>
              <dd className="font-medium text-ink-900">{user?.email}</dd>
            </div>
          </dl>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold text-ink-900">Subscription</h2>
          <div className="mt-4 flex items-center gap-2 text-sm">
            {subscriptionActive ? (
              <CheckCircle2 className="h-4 w-4 text-brand-600" />
            ) : (
              <Circle className="h-4 w-4 text-ink-300" />
            )}
            <span className="font-medium text-ink-900">
              {subscriptionActive ? "Active" : "Inactive"}
            </span>
            {subscription?.plan && <span className="text-ink-400">· {subscription.plan}</span>}
          </div>
          <p className="mt-2 text-xs text-ink-400">
            One subscription unlocks every HR category and tool for your organization. This is a
            foundation service — payment provider integration is not wired up yet.
          </p>
        </section>
      </div>
    </div>
  );
}
