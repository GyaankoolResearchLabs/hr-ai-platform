import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  UserRound,
} from "lucide-react";

import employeeProfileService from "../services/employeeProfileService";

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function EmployeeProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadProfile() {
    try {
      setLoading(true);
      setError("");

      const data = await employeeProfileService.getMyProfile();

      setProfile(data || null);
    } catch (err) {
      console.error("Employee profile load error:", err);

      setError(
        err?.response?.data?.message ||
          "Unable to load your profile.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-ink-500">
          <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
          Loading your profile...
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="mb-6">
        <Link
          to="/app/employee/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 transition hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Employee Portal
        </Link>
      </div>

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-ink-950">
            My Profile
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Your employee record from the shared HR platform.
          </p>
        </div>

        <button
          type="button"
          onClick={loadProfile}
          className="inline-flex items-center justify-center rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!error && (
        <section className="card p-5">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <UserRound className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-ink-950">
                {profile?.full_name || "Employee"}
              </h2>
              <p className="text-sm text-ink-500">
                {[profile?.title, profile?.department]
                  .filter(Boolean)
                  .join(" - ") || "No title on file"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ProfileField label="Full name" value={profile?.full_name} />
            <ProfileField label="Employee code" value={profile?.employee_code} />
            <ProfileField label="Email" value={profile?.email} />
            <ProfileField label="Department" value={profile?.department} />
            <ProfileField label="Designation" value={profile?.designation} />
            <ProfileField label="Employment status" value={profile?.employment_status} />
            <ProfileField label="Joining date" value={formatDate(profile?.joining_date)} />
            <ProfileField
              label="Last working date"
              value={
                profile?.last_working_date
                  ? formatDate(profile.last_working_date)
                  : "-"
              }
            />
            <ProfileField label="Location" value={profile?.location} />
            <ProfileField label="Address" value={profile?.address} />
            <ProfileField
              label="Reporting manager"
              value={profile?.manager?.full_name}
            />
          </div>
        </section>
      )}
    </div>
  );
}

function ProfileField({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
        {label}
      </p>
      <p className="mt-1 min-w-0 truncate text-sm font-medium text-ink-900">
        {value || "-"}
      </p>
    </div>
  );
}
