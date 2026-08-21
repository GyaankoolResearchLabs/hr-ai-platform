import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import AuthLayout from "../components/layout/AuthLayout";
import { organizationService } from "../services/organizationService";
import { useAuth } from "../context/AuthContext";

const SIZES = ["1–50", "51–200", "201–1000", "1000+"];

export default function OrganizationSetup() {
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [size, setSize] = useState(SIZES[0]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { refreshOrganization } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await organizationService.create({ name, industry, size });
      await refreshOrganization();
      navigate("/app/dashboard", { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || "Could not create your organization. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Set up your organization"
      subtitle="One workspace, one subscription, every HR tool"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-soft px-3 py-2 text-sm text-ink-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-700">Organization name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            placeholder="Acme Corporation"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-700">Industry</label>
          <input
            type="text"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            placeholder="e.g. Software, Manufacturing, Retail"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-700">Company size</label>
          <div className="grid grid-cols-4 gap-2">
            {SIZES.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setSize(s)}
                className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                  size === s
                    ? "border-brand-600 bg-brand-50 text-brand-800"
                    : "border-ink-200 text-ink-600 hover:bg-ink-50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-800 py-2.5 text-sm font-medium text-white transition hover:bg-brand-900 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Continue to dashboard
        </button>
      </form>
    </AuthLayout>
  );
}
