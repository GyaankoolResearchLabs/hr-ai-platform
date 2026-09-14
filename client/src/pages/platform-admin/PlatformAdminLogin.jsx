import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { authService } from "../../services/authService";

/*
|--------------------------------------------------------------------------
| PLATFORM ADMIN LOGIN
|--------------------------------------------------------------------------
|
| /platform-admin/login — a deliberately separate, minimal login form.
| Not built on pages/Login.jsx or components/layout/AuthLayout — this is
| meant to read as a distinct internal tool, not a themed part of the HR
| product.
|
| Authenticates against the SAME Supabase project/users as the main
| app's login (via services/authService.js's signIn(), which calls
| supabase.auth.signInWithPassword() directly — this is not a separate
| identity system, just a separate front door). On success it lands on
| /platform-admin/logs (or wherever PlatformAdminRoute redirected from),
| never /app/dashboard.
|
| Whether this account is actually a platform admin is NOT checked
| here — any real Supabase account can sign in. That check happens
| server-side, per request, once on /platform-admin/logs (every API
| call 404s for a non-admin) — see requirePlatformAdmin.js and
| PlatformAdminLogs.jsx's notFound state.
|--------------------------------------------------------------------------
*/

export default function PlatformAdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  const location = useLocation();

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await authService.signIn({ email, password });
      setSignedIn(true);
    } catch (submitError) {
      setError(
        submitError?.message || "Login failed. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  }

  // Redirect only after a real, committed sign-in — never render this
  // route's own <Navigate> speculatively based on ambient session state,
  // so a fresh visit always shows the form instead of racing a redirect.
  if (signedIn) {
    return (
      <Navigate
        to={location.state?.from?.pathname || "/platform-admin/logs"}
        replace
      />
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#0b0d12] px-4 text-slate-200">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <ShieldAlert className="h-6 w-6 text-slate-400" />
          <h1 className="text-base font-semibold text-slate-100">
            Platform Admin
          </h1>
          <p className="text-xs text-slate-500">Internal tool — not part of the HR product.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-3 rounded-lg border border-slate-800 bg-[#11141b] p-5"
        >
          {error && (
            <div className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Email
            </label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-slate-700 bg-[#0b0d12] px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-slate-700 bg-[#0b0d12] px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-100 py-2 text-sm font-medium text-[#0b0d12] transition hover:bg-white disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
