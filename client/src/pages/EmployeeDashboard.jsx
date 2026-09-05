import { useEffect, useMemo, useState } from "react";
import {
  BadgeIndianRupee,
  CalendarCheck,
  FileText,
  GraduationCap,
  Loader2,
  ReceiptText,
  UserRound,
} from "lucide-react";

import api from "../lib/api";

function formatCurrency(value) {
  const number = Number(value || 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(number);
}

function getFirstName(name) {
  return String(name || "")
    .trim()
    .split(" ")[0];
}

function countByStatus(items, status) {
  return items.filter(
    (item) =>
      String(item.status || "")
        .trim()
        .toLowerCase() === status,
  ).length;
}

export default function EmployeeDashboard() {
  const [profile, setProfile] = useState(null);
  const [payroll, setPayroll] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [claims, setClaims] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const [
        profileResponse,
        payrollResponse,
        payslipResponse,
        claimResponse,
        leaveRequestResponse,
        leaveBalanceResponse,
        attendanceResponse,
        requestResponse,
      ] = await Promise.all([
        api.get("/employees/me"),
        api.get("/payroll-runs/me"),
        api.get("/payslips/me"),
        api.get("/expense-claims/me"),
        api.get("/attendance-leave/me/leave/requests"),
        api.get("/attendance-leave/me/leave/balances"),
        api.get("/attendance-leave/me/attendance"),
        api.get("/employee-self-service"),
      ]);

      setProfile(profileResponse.data || null);
      setPayroll(payrollResponse.data?.data || []);
      setPayslips(payslipResponse.data?.data || []);
      setClaims(claimResponse.data?.claims || []);
      setLeaveRequests(leaveRequestResponse.data?.requests || []);
      setLeaveBalances(leaveBalanceResponse.data?.balances || []);
      setAttendance(attendanceResponse.data?.attendance || []);
      setRequests(
        Array.isArray(requestResponse.data)
          ? requestResponse.data
          : [],
      );
    } catch (err) {
      console.error("Employee dashboard load error:", err);

      setError(
        err?.response?.data?.message ||
          "Unable to load your employee dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const latestPayroll = payroll[0] || null;

  const attendanceSummary = useMemo(() => {
    const total = attendance.length;
    const present = countByStatus(attendance, "present");
    const absent = countByStatus(attendance, "absent");
    const leave = attendance.filter((item) =>
      ["on leave", "leave", "on_leave"].includes(
        String(item.status || "").trim().toLowerCase(),
      ),
    ).length;

    return {
      total,
      present,
      absent,
      leave,
      percentage: total
        ? Math.round((present / total) * 100)
        : 0,
    };
  }, [attendance]);

  const leaveSummary = useMemo(() => {
    const available = leaveBalances.reduce(
      (sum, balance) => {
        const allocated = Number(balance.allocated || 0);
        const carriedForward = Number(
          balance.carried_forward ||
            balance.carriedForward ||
            0,
        );
        const used = Number(balance.used || 0);

        return sum + Math.max(0, allocated + carriedForward - used);
      },
      0,
    );

    return {
      available,
      pending: countByStatus(leaveRequests, "pending"),
      approved: countByStatus(leaveRequests, "approved"),
    };
  }, [leaveBalances, leaveRequests]);

  const claimSummary = useMemo(() => {
    const pending = claims.filter((claim) =>
      ["draft", "submitted", "under_review"].includes(
        String(claim.status || "").trim().toLowerCase(),
      ),
    );

    return {
      pending: pending.length,
      approved: countByStatus(claims, "approved"),
      paid: countByStatus(claims, "paid"),
      pendingAmount: pending.reduce(
        (sum, claim) => sum + Number(claim.total_amount || 0),
        0,
      ),
    };
  }, [claims]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-ink-500">
          <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
          Loading your employee dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-ink-950">
            {profile?.full_name
              ? `Good day, ${getFirstName(profile.full_name)}`
              : "Employee Dashboard"}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {[profile?.department, profile?.title, profile?.location]
              .filter(Boolean)
              .join(" - ") || "Your HR information from the shared platform."}
          </p>
        </div>

        <button
          type="button"
          onClick={loadDashboard}
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

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <UserRound className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-ink-950">
                My Profile
              </h2>
              <p className="text-sm text-ink-500">
                Shared employee record
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ProfileField label="Name" value={profile?.full_name} />
            <ProfileField label="Employee code" value={profile?.employee_code} />
            <ProfileField label="Email" value={profile?.email} />
            <ProfileField label="Department" value={profile?.department} />
            <ProfileField label="Designation" value={profile?.title} />
            <ProfileField label="Status" value={profile?.employment_status} />
          </div>
        </section>

        <section className="card p-5">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <CalendarCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-ink-950">
                Attendance
              </h2>
              <p className="text-sm text-ink-500">
                Latest loaded records
              </p>
            </div>
          </div>

          <Metric label="Attendance rate" value={`${attendanceSummary.percentage}%`} />
          <div className="mt-4 grid grid-cols-3 gap-3">
            <SmallMetric label="Present" value={attendanceSummary.present} />
            <SmallMetric label="Absent" value={attendanceSummary.absent} />
            <SmallMetric label="Leave" value={attendanceSummary.leave} />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={BadgeIndianRupee}
          title="Payroll"
          value={
            latestPayroll
              ? formatCurrency(latestPayroll.net_pay)
              : "No processed payroll"
          }
          detail={
            latestPayroll?.payroll_runs?.payroll_month ||
            "Processed payroll appears here"
          }
        />

        <SummaryCard
          icon={FileText}
          title="Payslips"
          value={payslips.length}
          detail="Published payslips only"
        />

        <SummaryCard
          icon={ReceiptText}
          title="Reimbursements"
          value={formatCurrency(claimSummary.pendingAmount)}
          detail={`${claimSummary.pending} pending, ${claimSummary.paid} paid`}
        />

        <SummaryCard
          icon={GraduationCap}
          title="Leave"
          value={`${leaveSummary.available}`}
          detail={`${leaveSummary.pending} pending, ${leaveSummary.approved} approved`}
        />
      </div>

      <section className="mt-6 card overflow-hidden">
        <div className="border-b border-ink-100 px-5 py-4">
          <h2 className="text-base font-semibold text-ink-950">
            Recent HR Requests
          </h2>
        </div>

        {requests.length === 0 ? (
          <div className="px-5 py-8 text-sm text-ink-500">
            You have not submitted any HR requests yet.
          </div>
        ) : (
          <div className="divide-y divide-ink-100">
            {requests.slice(0, 5).map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-900">
                    {request.subject || request.title || "HR Request"}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">
                    {request.request_type || request.category || "general"}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-ink-50 px-2.5 py-1 text-xs font-medium text-ink-600">
                  {request.status || "submitted"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
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

function Metric({ label, value }) {
  return (
    <div>
      <p className="text-sm text-ink-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-ink-950">{value}</p>
    </div>
  );
}

function SmallMetric({ label, value }) {
  return (
    <div className="rounded-lg bg-ink-50 px-3 py-2">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink-950">{value}</p>
    </div>
  );
}

function SummaryCard({ icon: Icon, title, value, detail }) {
  return (
    <section className="card p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        <Icon className="h-5 w-5 text-brand-700" />
      </div>
      <p className="text-xl font-semibold text-ink-950">{value}</p>
      <p className="mt-2 text-sm text-ink-500">{detail}</p>
    </section>
  );
}
