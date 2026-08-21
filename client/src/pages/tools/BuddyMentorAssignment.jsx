import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { supabase } from "../../lib/supabaseClient";

import {
  ArrowLeft,
  RefreshCw,
  Users,
  UserRound,
  CalendarDays,
  Search,
  AlertCircle,
  UserPlus,
  UserCheck,
  UserX,
  CheckCircle2,
  X,
} from "lucide-react";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000/api";

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    config.headers = config.headers || {};
    config.headers.Authorization =
      `Bearer ${session.access_token}`;
  }

  return config;
});

/* =========================================================
   HELPERS
========================================================= */

function getEmployeeId(employee) {
  return (
    employee?.id ||
    employee?.employee_id ||
    null
  );
}

function getEmployeeName(employee) {
  return (
    employee?.full_name ||
    employee?.name ||
    `${employee?.first_name || ""} ${
      employee?.last_name || ""
    }`.trim() ||
    "Unnamed employee"
  );
}

function getEmployeeDepartment(employee) {
  return (
    employee?.department ||
    employee?.department_name ||
    "—"
  );
}

function getEmployeeTitle(employee) {
  return (
    employee?.title ||
    employee?.designation ||
    employee?.job_title ||
    "—"
  );
}

function getEmployeeEmail(employee) {
  return (
    employee?.email ||
    employee?.work_email ||
    employee?.company_email ||
    ""
  );
}

function getEmployeeStatus(employee) {
  return (
    employee?.employment_status ||
    employee?.status ||
    "active"
  );
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getInitials(employee) {
  const name = getEmployeeName(employee);

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "?";

  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return (
    parts[0].charAt(0) +
    parts[parts.length - 1].charAt(0)
  ).toUpperCase();
}

function isActiveEmployee(employee) {
  const status = getEmployeeStatus(employee)
    .toString()
    .toLowerCase();

  return ![
    "inactive",
    "terminated",
    "resigned",
    "offboarded",
    "exited",
    "deleted",
  ].includes(status);
}

/* =========================================================
   COMPONENT
========================================================= */

export default function BuddyMentorAssignment() {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [journeys, setJourneys] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedNewHire, setSelectedNewHire] =
    useState(null);

  const [buddySearch, setBuddySearch] =
    useState("");

  const [selectedBuddyId, setSelectedBuddyId] =
    useState("");

  /* =======================================================
     LOAD DATA
  ======================================================= */

  async function loadData(showRefreshState = false) {
    try {
      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const [
        employeesResponse,
        journeysResponse,
        assignmentsResponse,
      ] = await Promise.all([
        api.get("/employees"),
        api.get("/onboarding/journeys"),
        api.get("/buddy-mentor/assignments"),
      ]);

      const employeeData =
        Array.isArray(employeesResponse?.data)
          ? employeesResponse.data
          : employeesResponse?.data?.employees ||
            [];

      const journeyData =
        journeysResponse?.data?.journeys ||
        [];

      const assignmentData =
        assignmentsResponse?.data?.assignments ||
        [];

      setEmployees(
        Array.isArray(employeeData)
          ? employeeData
          : []
      );

      setJourneys(
        Array.isArray(journeyData)
          ? journeyData
          : []
      );

      setAssignments(
        Array.isArray(assignmentData)
          ? assignmentData
          : []
      );
    } catch (err) {
      console.error(
        "[BuddyMentorAssignment] Failed to load data:",
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to load buddy assignment data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  /* =======================================================
     ONBOARDING EMPLOYEES
  ======================================================= */

  const onboardingEmployees = useMemo(() => {
    if (
      !Array.isArray(journeys) ||
      journeys.length === 0
    ) {
      return [];
    }

    const employeeMap = new Map(
      employees.map((employee) => [
        String(getEmployeeId(employee)),
        employee,
      ])
    );

    return journeys
      .map((journey) => {
        const employeeId =
          journey?.employee_id ||
          journey?.employeeId;

        const employee =
          employeeMap.get(
            String(employeeId)
          );

        if (!employee) {
          return null;
        }

        return {
          employee,
          journey,
        };
      })
      .filter(Boolean);
  }, [employees, journeys]);

  /* =======================================================
     ASSIGNMENT MAP
  ======================================================= */

  const assignmentMap = useMemo(() => {
    const map = new Map();

    assignments.forEach((assignment) => {
      if (
        assignment?.status === "active" ||
        assignment?.status === "completed"
      ) {
        map.set(
          String(assignment.new_hire_id),
          assignment
        );
      }
    });

    return map;
  }, [assignments]);

  /* =======================================================
     EMPLOYEE MAP
  ======================================================= */

  const employeeMap = useMemo(() => {
    return new Map(
      employees.map((employee) => [
        String(getEmployeeId(employee)),
        employee,
      ])
    );
  }, [employees]);

  /* =======================================================
     FILTERED NEW HIRES
  ======================================================= */

  const filteredEmployees = useMemo(() => {
    const value =
      search.trim().toLowerCase();

    if (!value) {
      return onboardingEmployees;
    }

    return onboardingEmployees.filter(
      ({ employee }) => {
        const name =
          getEmployeeName(employee)
            .toLowerCase();

        const department =
          getEmployeeDepartment(employee)
            .toLowerCase();

        const title =
          getEmployeeTitle(employee)
            .toLowerCase();

        return (
          name.includes(value) ||
          department.includes(value) ||
          title.includes(value)
        );
      }
    );
  }, [
    onboardingEmployees,
    search,
  ]);

  /* =======================================================
     AVAILABLE BUDDIES
  ======================================================= */

  const availableBuddies = useMemo(() => {
    if (!selectedNewHire) {
      return [];
    }

    const newHireId = String(
      getEmployeeId(
        selectedNewHire.employee
      )
    );

    return employees.filter((employee) => {
      const employeeId = String(
        getEmployeeId(employee)
      );

      if (!employeeId) {
        return false;
      }

      if (employeeId === newHireId) {
        return false;
      }

      return isActiveEmployee(employee);
    });
  }, [
    employees,
    selectedNewHire,
  ]);

  /* =======================================================
     FILTERED BUDDIES
  ======================================================= */

  const filteredBuddies = useMemo(() => {
    const value =
      buddySearch.trim().toLowerCase();

    if (!value) {
      return availableBuddies;
    }

    return availableBuddies.filter(
      (employee) => {
        const name =
          getEmployeeName(employee)
            .toLowerCase();

        const department =
          getEmployeeDepartment(employee)
            .toLowerCase();

        const title =
          getEmployeeTitle(employee)
            .toLowerCase();

        const email =
          getEmployeeEmail(employee)
            .toLowerCase();

        return (
          name.includes(value) ||
          department.includes(value) ||
          title.includes(value) ||
          email.includes(value)
        );
      }
    );
  }, [
    availableBuddies,
    buddySearch,
  ]);

  /* =======================================================
     SUMMARY
  ======================================================= */

  const summary = useMemo(() => {
    const activeAssignments =
      assignments.filter(
        (assignment) =>
          assignment?.status === "active"
      );

    const completedAssignments =
      assignments.filter(
        (assignment) =>
          assignment?.status === "completed"
      );

    return {
      newHires:
        onboardingEmployees.length,

      journeys:
        journeys.length,

      assigned:
        activeAssignments.length,

      completed:
        completedAssignments.length,

      unassigned:
        onboardingEmployees.filter(
          ({ employee }) =>
            !assignmentMap.has(
              String(
                getEmployeeId(employee)
              )
            )
        ).length,
    };
  }, [
    onboardingEmployees,
    journeys,
    assignments,
    assignmentMap,
  ]);

  /* =======================================================
     OPEN ASSIGN MODAL
  ======================================================= */

  function openAssignModal(
    employee,
    journey
  ) {
    setSelectedNewHire({
      employee,
      journey,
    });

    setSelectedBuddyId("");
    setBuddySearch("");
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  /* =======================================================
     CLOSE MODAL
  ======================================================= */

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setSelectedNewHire(null);
    setSelectedBuddyId("");
    setBuddySearch("");
  }

  /* =======================================================
     ASSIGN / REASSIGN BUDDY
  ======================================================= */

  async function handleAssignBuddy() {
    if (!selectedNewHire) {
      return;
    }

    if (!selectedBuddyId) {
      setError(
        "Select an employee to assign as buddy."
      );
      return;
    }

    const newHireId = getEmployeeId(
      selectedNewHire.employee
    );

    if (!newHireId) {
      setError(
        "Unable to determine the new hire."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const existingAssignment =
        assignmentMap.get(
          String(newHireId)
        );

      if (
        existingAssignment &&
        existingAssignment.status ===
          "active"
      ) {
        const response =
          await api.patch(
            `/buddy-mentor/assignments/${existingAssignment.id}`,
            {
              buddyId: selectedBuddyId,
              role: "buddy",
              status: "active",
            }
          );

        const updated =
          response?.data?.assignment;

        if (updated) {
          setAssignments((current) =>
            current.map((item) =>
              item.id === updated.id
                ? updated
                : item
            )
          );
        }

        setSuccess(
          "Buddy assignment updated successfully."
        );
      } else {
        const response =
          await api.post(
            "/buddy-mentor/assignments",
            {
              newHireId,
              buddyId: selectedBuddyId,
              role: "buddy",
            }
          );

        const created =
          response?.data?.assignment;

        if (created) {
          setAssignments((current) => [
            created,
            ...current,
          ]);
        }

        setSuccess(
          "Buddy assigned successfully."
        );
      }

      setModalOpen(false);
      setSelectedNewHire(null);
      setSelectedBuddyId("");
      setBuddySearch("");

      await loadData(true);
    } catch (err) {
      console.error(
        "[BuddyMentorAssignment] Buddy assignment failed:",
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to assign buddy."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     COMPLETE ASSIGNMENT
  ======================================================= */

  async function handleCompleteAssignment(
    assignment
  ) {
    if (!assignment?.id) {
      return;
    }

    const confirmed = window.confirm(
      "Mark this buddy assignment as completed?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response =
        await api.patch(
          `/buddy-mentor/assignments/${assignment.id}`,
          {
            status: "completed",
          }
        );

      const updated =
        response?.data?.assignment;

      if (updated) {
        setAssignments((current) =>
          current.map((item) =>
            item.id === updated.id
              ? updated
              : item
          )
        );
      }

      setSuccess(
        "Buddy assignment marked as completed."
      );

      await loadData(true);
    } catch (err) {
      console.error(
        "[BuddyMentorAssignment] Complete assignment failed:",
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to complete assignment."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     REMOVE ASSIGNMENT
  ======================================================= */

  async function handleRemoveAssignment(
    assignment
  ) {
    if (!assignment?.id) {
      return;
    }

    const confirmed = window.confirm(
      "Remove this buddy assignment?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api.delete(
        `/buddy-mentor/assignments/${assignment.id}`
      );

      setAssignments((current) =>
        current.filter(
          (item) =>
            item.id !== assignment.id
        )
      );

      setSuccess(
        "Buddy assignment removed."
      );

      await loadData(true);
    } catch (err) {
      console.error(
        "[BuddyMentorAssignment] Remove assignment failed:",
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to remove buddy assignment."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="min-w-0">
      {/* =====================================================
          BACK
      ===================================================== */}

      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-ink-500 transition hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Users className="h-5 w-5" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-ink-900">
              Buddy / Mentor Assignment
            </h1>

            <p className="mt-1 text-sm text-ink-500">
              Assign structured peer support to new hires.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => loadData(true)}
          disabled={
            loading ||
            refreshing ||
            saving
          }
          className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              refreshing
                ? "animate-spin"
                : ""
            }`}
          />
          Refresh
        </button>
      </div>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

          <span className="flex-1">
            {error}
          </span>

          <button
            type="button"
            onClick={() => setError("")}
            className="text-red-500 hover:text-red-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* =====================================================
          SUCCESS
      ===================================================== */}

      {success && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />

          <span className="flex-1">
            {success}
          </span>

          <button
            type="button"
            onClick={() => setSuccess("")}
            className="text-emerald-500 hover:text-emerald-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <UserRound className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                New hires
              </p>

              <p className="mt-1 text-2xl font-semibold text-ink-900">
                {loading
                  ? "—"
                  : summary.newHires}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <UserCheck className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                Active buddies
              </p>

              <p className="mt-1 text-2xl font-semibold text-ink-900">
                {loading
                  ? "—"
                  : summary.assigned}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <UserPlus className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                Needs buddy
              </p>

              <p className="mt-1 text-2xl font-semibold text-ink-900">
                {loading
                  ? "—"
                  : summary.unassigned}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-50 text-ink-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                Completed
              </p>

              <p className="mt-1 text-2xl font-semibold text-ink-900">
                {loading
                  ? "—"
                  : summary.completed}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================
          SEARCH
      ===================================================== */}

      <div className="mb-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />

          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search new hires..."
            className="w-full rounded-lg border border-ink-200 bg-white py-2.5 pl-10 pr-4 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
      </div>

      {/* =====================================================
          NEW HIRES
      ===================================================== */}

      <div className="card overflow-hidden">
        <div className="border-b border-ink-100 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink-900">
                New Hires
              </h2>

              <p className="mt-1 text-sm text-ink-500">
                Employees with onboarding journeys from your organization.
              </p>
            </div>

            <span className="text-sm text-ink-400">
              {filteredEmployees.length} employee
              {filteredEmployees.length === 1
                ? ""
                : "s"}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-12 text-center text-sm text-ink-500">
            Loading employee data...
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <UserRound className="mx-auto h-8 w-8 text-ink-300" />

            <p className="mt-3 text-sm font-medium text-ink-700">
              No onboarding employees found
            </p>

            <p className="mt-1 text-sm text-ink-400">
              The list will update automatically when onboarding data exists.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-ink-100">
            {filteredEmployees.map(
              ({ employee, journey }) => {
                const employeeId =
                  getEmployeeId(employee);

                const assignment =
                  assignmentMap.get(
                    String(employeeId)
                  );

                const buddy =
                  assignment
                    ? employeeMap.get(
                        String(
                          assignment.buddy_id
                        )
                      )
                    : null;

                const isCompleted =
                  assignment?.status ===
                  "completed";

                return (
                  <div
                    key={`${employeeId}-${journey?.id || "journey"}`}
                    className="px-5 py-5"
                  >
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                      {/* EMPLOYEE */}

                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink-100 text-sm font-semibold text-ink-600">
                          {getInitials(
                            employee
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-ink-900">
                              {getEmployeeName(
                                employee
                              )}
                            </p>

                            {assignment && (
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  isCompleted
                                    ? "bg-ink-100 text-ink-600"
                                    : "bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {isCompleted
                                  ? "Completed"
                                  : "Buddy assigned"}
                              </span>
                            )}
                          </div>

                          <p className="mt-0.5 text-sm text-ink-500">
                            {getEmployeeTitle(
                              employee
                            )}
                          </p>

                          <p className="mt-0.5 text-xs text-ink-400">
                            {getEmployeeDepartment(
                              employee
                            )}
                          </p>
                        </div>
                      </div>

                      {/* JOURNEY */}

                      <div className="flex flex-wrap items-center gap-6">
                        <div>
                          <p className="text-xs text-ink-400">
                            Joining date
                          </p>

                          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-ink-700">
                            <CalendarDays className="h-3.5 w-3.5 text-ink-400" />

                            {formatDate(
                              journey?.joining_date ||
                                journey?.joiningDate ||
                                employee?.joining_date
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-ink-400">
                            Journey status
                          </p>

                          <p className="mt-1 text-sm font-medium capitalize text-ink-700">
                            {journey?.status ||
                              "—"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* =================================================
                        BUDDY SECTION
                    ================================================= */}

                    <div className="mt-5 rounded-xl border border-ink-100 bg-canvas p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                            Buddy
                          </p>

                          {buddy ? (
                            <div className="mt-2 flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                                {getInitials(
                                  buddy
                                )}
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-ink-800">
                                  {getEmployeeName(
                                    buddy
                                  )}
                                </p>

                                <p className="truncate text-xs text-ink-500">
                                  {getEmployeeTitle(
                                    buddy
                                  )}{" "}
                                  ·{" "}
                                  {getEmployeeDepartment(
                                    buddy
                                  )}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <p className="mt-1 text-sm text-ink-500">
                              No buddy assigned yet.
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {!assignment && (
                            <button
                              type="button"
                              onClick={() =>
                                openAssignModal(
                                  employee,
                                  journey
                                )
                              }
                              disabled={saving}
                              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <UserPlus className="h-4 w-4" />
                              Assign Buddy
                            </button>
                          )}

                          {assignment &&
                            !isCompleted && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    openAssignModal(
                                      employee,
                                      journey
                                    )
                                  }
                                  disabled={
                                    saving
                                  }
                                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Users className="h-4 w-4" />
                                  Change Buddy
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCompleteAssignment(
                                      assignment
                                    )
                                  }
                                  disabled={
                                    saving
                                  }
                                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                  Complete
                                </button>
                              </>
                            )}

                          {assignment && (
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveAssignment(
                                  assignment
                                )
                              }
                              disabled={saving}
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <UserX className="h-4 w-4" />
                              Remove
                            </button>
                          )}
                        </div>
                      </div>

                      {assignment && (
                        <div className="mt-3 border-t border-ink-100 pt-3 text-xs text-ink-400">
                          Assigned{" "}
                          {formatDate(
                            assignment.assigned_at
                          )}

                          {assignment.completed_at &&
                            ` · Completed ${formatDate(
                              assignment.completed_at
                            )}`}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>

      {/* =====================================================
          ASSIGN BUDDY MODAL
      ===================================================== */}

      {modalOpen &&
        selectedNewHire && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl">
              {/* MODAL HEADER */}

              <div className="flex items-start justify-between border-b border-ink-100 px-6 py-5">
                <div>
                  <h2 className="text-lg font-semibold text-ink-900">
                    Assign Buddy
                  </h2>

                  <p className="mt-1 text-sm text-ink-500">
                    Select an active employee to support this new hire.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-50 hover:text-ink-700 disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* NEW HIRE */}

              <div className="border-b border-ink-100 bg-canvas px-6 py-4">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                  New hire
                </p>

                <div className="mt-2 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                    {getInitials(
                      selectedNewHire.employee
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-ink-900">
                      {getEmployeeName(
                        selectedNewHire.employee
                      )}
                    </p>

                    <p className="text-xs text-ink-500">
                      {getEmployeeTitle(
                        selectedNewHire.employee
                      )}{" "}
                      ·{" "}
                      {getEmployeeDepartment(
                        selectedNewHire.employee
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* SEARCH */}

              <div className="px-6 pt-5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />

                  <input
                    type="text"
                    value={buddySearch}
                    onChange={(event) =>
                      setBuddySearch(
                        event.target.value
                      )
                    }
                    placeholder="Search employees by name, role, department..."
                    className="w-full rounded-lg border border-ink-200 bg-white py-2.5 pl-10 pr-4 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </div>
              </div>

              {/* EMPLOYEE LIST */}

              <div className="max-h-80 overflow-y-auto px-6 py-4">
                {filteredBuddies.length ===
                0 ? (
                  <div className="py-8 text-center">
                    <UserRound className="mx-auto h-8 w-8 text-ink-300" />

                    <p className="mt-2 text-sm font-medium text-ink-700">
                      No available employees found
                    </p>

                    <p className="mt-1 text-xs text-ink-400">
                      Only active employees other than the new hire can be selected.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredBuddies.map(
                      (employee) => {
                        const id =
                          String(
                            getEmployeeId(
                              employee
                            )
                          );

                        const selected =
                          selectedBuddyId ===
                          id;

                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() =>
                              setSelectedBuddyId(
                                id
                              )
                            }
                            className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                              selected
                                ? "border-brand-500 bg-brand-50"
                                : "border-ink-100 bg-white hover:border-ink-200 hover:bg-ink-50"
                            }`}
                          >
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                                selected
                                  ? "bg-brand-100 text-brand-700"
                                  : "bg-ink-100 text-ink-600"
                              }`}
                            >
                              {getInitials(
                                employee
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-ink-900">
                                {getEmployeeName(
                                  employee
                                )}
                              </p>

                              <p className="truncate text-xs text-ink-500">
                                {getEmployeeTitle(
                                  employee
                                )}{" "}
                                ·{" "}
                                {getEmployeeDepartment(
                                  employee
                                )}
                              </p>

                              {getEmployeeEmail(
                                employee
                              ) && (
                                <p className="truncate text-xs text-ink-400">
                                  {getEmployeeEmail(
                                    employee
                                  )}
                                </p>
                              )}
                            </div>

                            {selected && (
                              <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-600" />
                            )}
                          </button>
                        );
                      }
                    )}
                  </div>
                )}
              </div>

              {/* FOOTER */}

              <div className="flex items-center justify-end gap-3 border-t border-ink-100 px-6 py-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-700 transition hover:bg-ink-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleAssignBuddy}
                  disabled={
                    saving ||
                    !selectedBuddyId
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-4 w-4" />
                      Assign Buddy
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}