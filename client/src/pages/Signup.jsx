import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import AuthLayout from "../components/layout/AuthLayout";
import { authService } from "../services/authService";

export default function Signup() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { data, error } = await authService.signUp({ email, password, fullName });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    // If email confirmation is disabled on the Supabase project, a session
    // comes back immediately and we can continue straight to org setup.
    if (data?.session) {
      navigate("/organization/setup", { replace: true });
    } else {
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <AuthLayout title="Check your inbox">
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <CheckCircle2 className="h-8 w-8 text-brand-600" />
          <p className="text-sm text-ink-600">
            We sent a confirmation link to <span className="font-medium text-ink-900">{email}</span>.
            Confirm your email, then log in to set up your organization.
          </p>
          <Link to="/login" className="mt-2 text-sm font-medium text-brand-700 hover:underline">
            Back to login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Set up your organization's HR AI Platform workspace"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-brand-700 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-soft px-3 py-2 text-sm text-ink-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-700">Full name</label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            placeholder="Jane Cooper"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-700">Work email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            placeholder="you@company.com"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-700">Password</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            placeholder="At least 6 characters"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-800 py-2.5 text-sm font-medium text-white transition hover:bg-brand-900 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Create account
        </button>
      </form>
    </AuthLayout>
  );
}
