import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  CheckCircle2,
  Circle,
  Edit3,
  Save,
  X,
  Building2,
  User,
  CreditCard,
  AlertCircle,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { organizationService } from "../services/organizationService";

const INDUSTRY_OPTIONS = [
  "Technology",
  "Healthcare",
  "Finance & Banking",
  "Education",
  "Manufacturing",
  "Retail & E-Commerce",
  "Consulting",
  "Real Estate",
  "Logistics & Supply Chain",
  "Media & Entertainment",
  "Legal",
  "Non-Profit",
  "Government",
  "Other",
];

const SIZE_OPTIONS = [
  "1–10",
  "11–50",
  "51–200",
  "201–500",
  "501–1000",
  "1001–5000",
  "5000+",
];

function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
        <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
      </span>
      <div>
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-ink-500">{description}</p>
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  const {
    organization,
    subscription,
    subscriptionActive,
    user,
    refreshOrganization,
  } = useAuth();

  // ── Edit state ──────────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: organization?.name || "",
    industry: organization?.industry || "",
    size: organization?.size || "",
  });

  const [formError, setFormError] = useState("");

  // ── Sync form when org changes ───────────────────────────────────────────
  function startEditing() {
    setForm({
      name: organization?.name || "",
      industry: organization?.industry || "",
      size: organization?.size || "",
    });
    setFormError("");
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setFormError("");
  }

  async function handleSave(e) {
    e.preventDefault();
    const name = form.name.trim();

    if (!name) {
      setFormError("Organization name is required.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      await organizationService.update({
        name,
        industry: form.industry || null,
        size: form.size || null,
      });

      // Refresh organization data in AuthContext
      if (refreshOrganization) {
        await refreshOrganization();
      }

      toast.success("Organization settings saved.");
      setEditing(false);
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err.message ||
        "Could not save settings. Please try again.";
      setFormError(message);
    } finally {
      setSaving(false);
    }
  }

  // ── Plan display ─────────────────────────────────────────────────────────
  const planLabel = subscription?.plan
    ? subscription.plan
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : "—";

  const renewsAt = subscription?.renews_at
    ? new Date(subscription.renews_at).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="max-w-2xl">
      {/* ── PAGE HEADER ────────────────────────────────────────────────── */}
      <h1 className="font-display text-2xl font-semibold text-ink-950">
        Settings
      </h1>
      <p className="mt-1 text-sm text-ink-500">
        Manage your organization, account, and subscription.
      </p>

      <div className="mt-8 space-y-6">
        {/* ── ORGANIZATION ─────────────────────────────────────────────── */}
        <section className="card overflow-hidden">
          <div className="border-b border-ink-100 p-5">
            <div className="flex items-start justify-between gap-4">
              <SectionHeader
                icon={Building2}
                title="Organization"
                description="Update your organization's profile information."
              />

              {!editing && (
                <button
                  type="button"
                  onClick={startEditing}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:bg-ink-50"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit
                </button>
              )}
            </div>
          </div>

          <div className="p-5">
            {editing ? (
              <form onSubmit={handleSave} className="space-y-4">
                {formError && (
                  <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Name */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink-700">
                    Organization name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    placeholder="Acme Corp"
                  />
                </div>

                {/* Industry */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink-700">
                    Industry
                  </label>
                  <select
                    value={form.industry}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, industry: e.target.value }))
                    }
                    className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
                  >
                    <option value="">Select industry…</option>
                    {INDUSTRY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Size */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink-700">
                    Company size
                  </label>
                  <select
                    value={form.size}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, size: e.target.value }))
                    }
                    className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
                  >
                    <option value="">Select size…</option>
                    {SIZE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt} employees
                      </option>
                    ))}
                  </select>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-900 disabled:opacity-60"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {saving ? "Saving…" : "Save changes"}
                  </button>

                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50 disabled:opacity-60"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-500">Name</dt>
                  <dd className="font-medium text-ink-900">
                    {organization?.name || "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-500">Industry</dt>
                  <dd className="font-medium text-ink-900">
                    {organization?.industry || "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-500">Company size</dt>
                  <dd className="font-medium text-ink-900">
                    {organization?.size ? `${organization.size} employees` : "—"}
                  </dd>
                </div>
              </dl>
            )}
          </div>
        </section>

        {/* ── ACCOUNT ──────────────────────────────────────────────────── */}
        <section className="card overflow-hidden">
          <div className="border-b border-ink-100 p-5">
            <SectionHeader
              icon={User}
              title="Account"
              description="Your personal account details."
            />
          </div>

          <div className="p-5">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-500">Email</dt>
                <dd className="font-medium text-ink-900">{user?.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">User ID</dt>
                <dd className="font-mono text-xs text-ink-400">
                  {user?.id ? `${user.id.substring(0, 8)}…` : "—"}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* ── SUBSCRIPTION ─────────────────────────────────────────────── */}
        <section className="card overflow-hidden">
          <div className="border-b border-ink-100 p-5">
            <SectionHeader
              icon={CreditCard}
              title="Subscription"
              description="Your current plan and billing information."
            />
          </div>

          <div className="p-5">
            <div className="flex items-center gap-2 text-sm">
              {subscriptionActive ? (
                <CheckCircle2 className="h-4 w-4 text-brand-600" />
              ) : (
                <Circle className="h-4 w-4 text-ink-300" />
              )}
              <span className="font-medium text-ink-900">
                {subscriptionActive ? "Active" : "Inactive"}
              </span>
              {subscription?.plan && (
                <span className="text-ink-400">· {planLabel}</span>
              )}
              {subscription?.status === "trialing" && (
                <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Trial
                </span>
              )}
            </div>

            {renewsAt && (
              <p className="mt-2 text-xs text-ink-400">
                {subscription?.status === "trialing"
                  ? `Trial ends ${renewsAt}`
                  : `Renews ${renewsAt}`}
              </p>
            )}

            <p className="mt-3 text-xs text-ink-400 leading-relaxed">
              One subscription unlocks every HR category and tool for your
              organization. Payment provider integration is not wired up yet.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
