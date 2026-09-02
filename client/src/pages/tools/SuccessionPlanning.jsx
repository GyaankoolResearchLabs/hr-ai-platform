import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Target,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { api } from "../../lib/api";

/* ============================================================================
   HELPERS
============================================================================ */

function formatDate(value) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleDateString();
}

function normalizePlans(response) {
  const data = response?.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.plans)) return data.plans;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.successionPlans)) {
    return data.successionPlans;
  }

  return [];
}

function normalizeEmployees(response) {
  const data = response?.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.employees)) return data.employees;
  if (Array.isArray(data?.items)) return data.items;

  return [];
}

function getEmployeeName(employee) {
  if (!employee) return "Unassigned";

  return (
    employee.full_name ||
    employee.name ||
    `${employee.first_name || ""} ${employee.last_name || ""}`.trim() ||
    employee.email ||
    "Unknown employee"
  );
}

function getPlanReadinessScore(plan) {
  const directScore =
    plan?.readiness_score ??
    plan?.readinessScore;

  if (directScore !== null && directScore !== undefined && directScore !== "") {
    const numericScore = Number(directScore);

    if (Number.isFinite(numericScore)) {
      return Math.min(100, Math.max(0, numericScore));
    }
  }

  const successors = getSuccessors(plan);

  const primarySuccessor =
    successors.find(
      (successor) =>
        successor?.is_primary === true ||
        successor?.isPrimary === true
    ) || successors[0];

  const candidateScore =
    primarySuccessor?.readiness_score ??
    primarySuccessor?.readinessScore;

  const numericCandidateScore = Number(candidateScore);

  if (Number.isFinite(numericCandidateScore)) {
    return Math.min(100, Math.max(0, numericCandidateScore));
  }

  return 0;
}

function getReadinessLabel(score) {
  const value = Number(score);

  if (!Number.isFinite(value)) return "Not assessed";
  if (value >= 80) return "Ready Now";
  if (value >= 60) return "Ready Soon";
  if (value >= 40) return "Developing";

  return "At Risk";
}

function getReadinessClasses(score) {
  const value = Number(score);

  if (!Number.isFinite(value)) {
    return "bg-slate-50 text-slate-600 border-slate-200";
  }

  if (value >= 80) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (value >= 60) {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }

  if (value >= 40) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  return "bg-red-50 text-red-700 border-red-200";
}

function getStatusClasses(status) {
  switch (status) {
    case "ready":
    case "active":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "developing":
      return "bg-blue-50 text-blue-700 border-blue-200";

    case "at_risk":
    case "critical":
      return "bg-red-50 text-red-700 border-red-200";

    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

function getPlanRole(plan) {
  return (
    plan?.role_title ||
    plan?.role ||
    plan?.key_role ||
    plan?.position_title ||
    "Key Role"
  );
}

function getPlanTitle(plan) {
  return (
    plan?.title ||
    plan?.role_title ||
    plan?.role ||
    plan?.key_role ||
    "Untitled Succession Plan"
  );
}

function getHolder(plan) {
  return (
    plan?.current_holder ||
    plan?.role_holder ||
    plan?.employee ||
    plan?.currentEmployee ||
    null
  );
}

function getSuccessors(plan) {
  if (Array.isArray(plan?.successors)) {
    return plan.successors;
  }

  if (Array.isArray(plan?.candidates)) {
    return plan.candidates;
  }

  if (Array.isArray(plan?.successor_candidates)) {
    return plan.successor_candidates;
  }

  return [];
}

/* ============================================================================
   EMPTY FORM
============================================================================ */

const EMPTY_FORM = {
  title: "",
  role_title: "",
  department: "",
  current_holder_employee_id: "",
  criticality: "medium",
  target_transition_date: "",
  readiness_score: 0,
  primary_successor_employee_id: "",
  notes: "",
};

/* ============================================================================
   COMPONENT
============================================================================ */

export default function SuccessionPlanning() {
  const navigate = useNavigate();

  const [plans, setPlans] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState("");
  const [readinessFilter, setReadinessFilter] = useState("all");
  const [criticalityFilter, setCriticalityFilter] = useState("all");

  const [selectedPlan, setSelectedPlan] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  /* ==========================================================================
     NOTIFICATIONS
  ========================================================================== */

  function showSuccess(message) {
    setSuccessMessage(message);
    setErrorMessage("");

    window.setTimeout(() => {
      setSuccessMessage("");
    }, 4000);
  }

  function showError(message) {
    setErrorMessage(
      message || "Something went wrong. Please try again."
    );
    setSuccessMessage("");
  }

  /* ==========================================================================
     LOAD DATA
  ========================================================================== */

  async function loadPlans() {
    try {
      setLoading(true);
      setErrorMessage("");

      const response = await api.get("/succession-planning");

      const loadedPlans = normalizePlans(response);

      setPlans(loadedPlans);
    } catch (error) {
      console.error(
        "Failed to load succession plans:",
        error
      );

      showError(
        error?.response?.data?.message ||
          "Failed to load succession plans."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadEmployees() {
    try {
      setLoadingEmployees(true);

      const response = await api.get("/employees");

      const loadedEmployees = normalizeEmployees(response);

      setEmployees(loadedEmployees);
    } catch (error) {
      console.error(
        "Failed to load employees:",
        error
      );

      showError(
        error?.response?.data?.message ||
          "Failed to load employees."
      );
    } finally {
      setLoadingEmployees(false);
    }
  }

  async function loadAll() {
    await Promise.all([
      loadPlans(),
      loadEmployees(),
    ]);
  }

  useEffect(() => {
    loadAll();
  }, []);

  /* ==========================================================================
     FILTERING
  ========================================================================== */

  const filteredPlans = useMemo(() => {
    const query = search.trim().toLowerCase();

    return plans.filter((plan) => {
      const holder = getHolder(plan);
      const successors = getSuccessors(plan);

      const successorNames = successors
        .map((successor) =>
          getEmployeeName(
            successor?.employee || successor
          )
        )
        .join(" ");

      const searchableText = [
        getPlanTitle(plan),
        getPlanRole(plan),
        plan?.department,
        getEmployeeName(holder),
        successorNames,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (
        query &&
        !searchableText.includes(query)
      ) {
        return false;
      }

      const score = getPlanReadinessScore(plan);

      if (
        readinessFilter !== "all" &&
        getReadinessLabel(score) !== readinessFilter
      ) {
        return false;
      }

      const criticality =
        plan?.criticality || "medium";

      if (
        criticalityFilter !== "all" &&
        criticality !== criticalityFilter
      ) {
        return false;
      }

      return true;
    });
  }, [
    plans,
    search,
    readinessFilter,
    criticalityFilter,
  ]);

  /* ==========================================================================
     METRICS
  ========================================================================== */

  const metrics = useMemo(() => {
    let readyNow = 0;
    let developing = 0;
    let atRisk = 0;
    let criticalRoles = 0;

    plans.forEach((plan) => {
      const score = getPlanReadinessScore(plan);

      const label = getReadinessLabel(score);

      if (label === "Ready Now") {
        readyNow += 1;
      }

      if (
        label === "Developing" ||
        label === "Ready Soon"
      ) {
        developing += 1;
      }

      if (label === "At Risk") {
        atRisk += 1;
      }

      if (
        plan?.criticality === "high" ||
        plan?.criticality === "critical"
      ) {
        criticalRoles += 1;
      }
    });

    return {
      total: plans.length,
      readyNow,
      developing,
      atRisk,
      criticalRoles,
    };
  }, [plans]);

  /* ==========================================================================
     FORM
  ========================================================================== */

  function openCreateForm() {
    setEditingPlan(null);
    setForm(EMPTY_FORM);
    setErrorMessage("");
    setSuccessMessage("");
    setShowForm(true);
  }

  function openEditForm(plan) {
    setEditingPlan(plan);

    setForm({
      title: plan?.title || "",
      role_title:
        plan?.role_title ||
        plan?.role ||
        plan?.key_role ||
        "",
      department: plan?.department || "",
      current_holder_employee_id:
        plan?.current_holder_employee_id ||
        plan?.current_holder_id ||
        plan?.currentEmployee?.id ||
        "",
      criticality:
        plan?.criticality || "medium",
      target_transition_date:
        plan?.target_transition_date
          ? String(
              plan.target_transition_date
            ).slice(0, 10)
          : "",
      readiness_score: getPlanReadinessScore(plan),
      primary_successor_employee_id:
        plan?.primary_successor_employee_id ||
        plan?.primary_successor_id ||
        "",
      notes: plan?.notes || "",
    });

    setErrorMessage("");
    setSuccessMessage("");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setEditingPlan(null);
    setForm(EMPTY_FORM);
  }

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  /* ==========================================================================
     SAVE
  ========================================================================== */

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.role_title.trim()) {
      showError("Role title is required.");
      return;
    }

    try {
      setSaving(true);
      setErrorMessage("");

      const payload = {
        title:
          form.title.trim() ||
          form.role_title.trim(),

        role_title:
          form.role_title.trim(),

        department:
          form.department.trim() || null,

        current_holder_employee_id:
          form.current_holder_employee_id || null,

        criticality:
          form.criticality,

        target_transition_date:
          form.target_transition_date || null,

        readiness_score:
          Number(form.readiness_score) || 0,

        primary_successor_employee_id:
          form.primary_successor_employee_id ||
          null,

        notes:
          form.notes.trim() || null,
      };

      let response;

      if (editingPlan) {
        response = await api.patch(
          `/succession-planning/${editingPlan.id}`,
          payload
        );
      } else {
        response = await api.post(
          "/succession-planning",
          payload
        );
      }

      const savedPlan =
        response?.data?.plan ||
        response?.data?.item ||
        response?.data?.successionPlan;

      showSuccess(
        editingPlan
          ? "Succession plan updated successfully."
          : "Succession plan created successfully."
      );

      setShowForm(false);
      setEditingPlan(null);
      setForm(EMPTY_FORM);

      await loadPlans();

      if (savedPlan) {
        setSelectedPlan(savedPlan);
      }
    } catch (error) {
      console.error(
        "Failed to save succession plan:",
        error
      );

      showError(
        error?.response?.data?.message ||
          "Failed to save succession plan."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ==========================================================================
     DELETE
  ========================================================================== */

  async function handleDelete(plan) {
    const confirmed = window.confirm(
      `Delete the succession plan for "${getPlanRole(
        plan
      )}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      setErrorMessage("");

      await api.delete(
        `/succession-planning/${plan.id}`
      );

      showSuccess(
        "Succession plan deleted successfully."
      );

      if (selectedPlan?.id === plan.id) {
        setSelectedPlan(null);
      }

      await loadPlans();
    } catch (error) {
      console.error(
        "Failed to delete succession plan:",
        error
      );

      showError(
        error?.response?.data?.message ||
          "Failed to delete succession plan."
      );
    } finally {
      setDeleting(false);
    }
  }

  /* ==========================================================================
     SELECT PLAN
  ========================================================================== */

  async function openDetails(plan) {
    try {
      setSelectedPlan(plan);

      const response = await api.get(
        `/succession-planning/${plan.id}`
      );

      const detailedPlan =
        response?.data?.plan ||
        response?.data?.item ||
        response?.data?.successionPlan;

      if (detailedPlan) {
        setSelectedPlan(detailedPlan);
      }
    } catch (error) {
      console.error(
        "Failed to load succession plan details:",
        error
      );

      showError(
        error?.response?.data?.message ||
          "Failed to load succession plan details."
      );
    }
  }

  /* ==========================================================================
     EMPLOYEE SELECT OPTIONS
  ========================================================================== */

  const employeeOptions = useMemo(() => {
    return [...employees].sort((a, b) =>
      getEmployeeName(a).localeCompare(
        getEmployeeName(b)
      )
    );
  }, [employees]);

  /* ==========================================================================
     RENDER
  ========================================================================== */

  return (
    <div className="min-h-full bg-canvas">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* HEADER */}

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-ink-500 transition hover:bg-ink-50 hover:text-ink-900"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs text-ink-400">
              <span>Strategic HR</span>
              <ChevronRight size={14} />
              <span>Succession</span>
            </div>

            <h1 className="text-2xl font-semibold text-ink-900">
              Succession Planning
            </h1>

            <p className="mt-1 max-w-2xl text-sm text-ink-500">
              Build proactive succession plans for
              critical roles and track employee
              readiness for future transitions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadAll}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={
                  loading
                    ? "animate-spin"
                    : ""
                }
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={openCreateForm}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              <Plus size={17} />
              Add Key Role
            </button>
          </div>
        </div>

        {/* NOTIFICATIONS */}

        {errorMessage && (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0"
            />
            <span>{errorMessage}</span>

            <button
              type="button"
              onClick={() => setErrorMessage("")}
              className="ml-auto"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mb-5 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <Check size={18} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* METRICS */}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={<BriefcaseBusiness size={18} />}
            label="Key Roles"
            value={metrics.total}
          />

          <MetricCard
            icon={<Check size={18} />}
            label="Ready Now"
            value={metrics.readyNow}
          />

          <MetricCard
            icon={<Target size={18} />}
            label="Developing"
            value={metrics.developing}
          />

          <MetricCard
            icon={<ShieldAlert size={18} />}
            label="At Risk"
            value={metrics.atRisk}
          />
        </div>

        {/* CONTROLS */}

        <div className="mb-5 rounded-xl border border-ink-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search roles, employees, departments..."
                className="w-full rounded-lg border border-ink-200 bg-white py-2.5 pl-10 pr-3 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            <select
              value={readinessFilter}
              onChange={(event) =>
                setReadinessFilter(
                  event.target.value
                )
              }
              className="rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-700 outline-none focus:border-brand-500"
            >
              <option value="all">
                All readiness
              </option>
              <option value="Ready Now">
                Ready Now
              </option>
              <option value="Ready Soon">
                Ready Soon
              </option>
              <option value="Developing">
                Developing
              </option>
              <option value="At Risk">
                At Risk
              </option>
            </select>

            <select
              value={criticalityFilter}
              onChange={(event) =>
                setCriticalityFilter(
                  event.target.value
                )
              }
              className="rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-700 outline-none focus:border-brand-500"
            >
              <option value="all">
                All criticality
              </option>
              <option value="critical">
                Critical
              </option>
              <option value="high">
                High
              </option>
              <option value="medium">
                Medium
              </option>
              <option value="low">
                Low
              </option>
            </select>
          </div>
        </div>

        {/* CONTENT */}

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-ink-100 bg-white">
            <div className="flex items-center gap-3 text-sm text-ink-500">
              <Loader2
                size={20}
                className="animate-spin"
              />
              Loading succession plans...
            </div>
          </div>
        ) : filteredPlans.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-200 bg-white px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Users size={22} />
            </div>

            <h3 className="text-sm font-semibold text-ink-900">
              No succession plans found
            </h3>

            <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">
              {plans.length === 0
                ? "Start by adding a critical role and defining who could step into it."
                : "Try changing your search or filters."}
            </p>

            {plans.length === 0 && (
              <button
                type="button"
                onClick={openCreateForm}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                <Plus size={16} />
                Add Key Role
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {filteredPlans.map((plan) => {
              const score = getPlanReadinessScore(plan);

              const holder = getHolder(plan);

              const successors =
                getSuccessors(plan);

              const readinessLabel =
                getReadinessLabel(score);

              return (
                <div
                  key={plan.id}
                  className="rounded-xl border border-ink-100 bg-white p-5 shadow-sm transition hover:border-brand-200 hover:shadow-md"
                >
                  {/* CARD HEADER */}

                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-1 text-[11px] font-semibold uppercase ${getStatusClasses(
                            plan?.criticality
                          )}`}
                        >
                          {plan?.criticality ||
                            "medium"}
                        </span>

                        <span
                          className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${getReadinessClasses(
                            score
                          )}`}
                        >
                          {readinessLabel}
                        </span>
                      </div>

                      <h3 className="truncate text-base font-semibold text-ink-900">
                        {getPlanTitle(plan)}
                      </h3>

                      <p className="mt-0.5 text-sm text-brand-700">
                        {getPlanRole(plan)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        openDetails(plan)
                      }
                      className="shrink-0 rounded-lg p-2 text-ink-400 transition hover:bg-ink-50 hover:text-ink-700"
                      title="View details"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>

                  {/* CURRENT HOLDER */}

                  <div className="mt-5 rounded-lg bg-canvas p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">
                      Current role holder
                    </p>

                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-ink-500">
                        <UserRound size={17} />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink-800">
                          {getEmployeeName(
                            holder
                          )}
                        </p>

                        {plan?.department && (
                          <p className="truncate text-xs text-ink-400">
                            {plan.department}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* READINESS */}

                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-ink-500">
                        Succession readiness
                      </span>

                      <span className="text-sm font-semibold text-ink-900">
                        {Number(score) || 0}%
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className="h-full rounded-full bg-brand-600 transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              0,
                              Number(score) || 0
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* SUCCESSORS */}

                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-medium text-ink-500">
                        Successor candidates
                      </p>

                      <span className="text-xs text-ink-400">
                        {successors.length}
                      </span>
                    </div>

                    {successors.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-ink-200 px-3 py-2.5 text-xs text-ink-400">
                        No successor candidates
                        assigned.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {successors
                          .slice(0, 3)
                          .map(
                            (
                              successor,
                              index
                            ) => {
                              const employee =
                                successor?.employee ||
                                successor;

                              return (
                                <div
                                  key={
                                    successor?.id ||
                                    employee?.id ||
                                    index
                                  }
                                  className="inline-flex items-center gap-2 rounded-lg border border-ink-100 bg-ink-50 px-2.5 py-1.5"
                                >
                                  <UserRound
                                    size={13}
                                    className="text-ink-400"
                                  />

                                  <span className="max-w-[150px] truncate text-xs font-medium text-ink-700">
                                    {getEmployeeName(
                                      employee
                                    )}
                                  </span>
                                </div>
                              );
                            }
                          )}

                        {successors.length > 3 && (
                          <span className="inline-flex items-center rounded-lg bg-ink-50 px-2.5 py-1.5 text-xs font-medium text-ink-500">
                            +
                            {successors.length -
                              3}{" "}
                            more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* FOOTER */}

                  <div className="mt-5 flex items-center justify-between border-t border-ink-100 pt-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-ink-400">
                        Target transition
                      </p>

                      <p className="mt-0.5 text-xs font-medium text-ink-700">
                        {formatDate(
                          plan?.target_transition_date ||
                            plan?.target_date
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          openEditForm(plan)
                        }
                        className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-50 hover:text-ink-700"
                        title="Edit"
                      >
                        <Edit3 size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleDelete(plan)
                        }
                        disabled={deleting}
                        className="rounded-lg p-2 text-ink-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* DETAILS DRAWER */}

        {selectedPlan && (
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              aria-label="Close details"
              onClick={() =>
                setSelectedPlan(null)
              }
              className="absolute inset-0 bg-black/30"
            />

            <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl">
              <div className="flex items-start justify-between border-b border-ink-100 px-6 py-5">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
                    Succession Plan
                  </p>

                  <h2 className="mt-1 text-lg font-semibold text-ink-900">
                    {getPlanTitle(
                      selectedPlan
                    )}
                  </h2>

                  <p className="mt-1 text-sm text-ink-500">
                    {getPlanRole(
                      selectedPlan
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedPlan(null)
                  }
                  className="rounded-lg p-2 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                <div className="grid grid-cols-2 gap-3">
                  <DetailMetric
                    label="Readiness"
                    value={`${Number(
                      selectedPlan?.readiness_score ??
                        selectedPlan?.readinessScore ??
                        0
                    ) || 0}%`}
                  />

                  <DetailMetric
                    label="Criticality"
                    value={
                      selectedPlan?.criticality ||
                      "Medium"
                    }
                  />
                </div>

                <section className="mt-6">
                  <h3 className="text-sm font-semibold text-ink-900">
                    Current role holder
                  </h3>

                  <div className="mt-3 rounded-lg border border-ink-100 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                        <UserRound
                          size={18}
                        />
                      </div>

                      <div>
                        <p className="text-sm font-medium text-ink-800">
                          {getEmployeeName(
                            getHolder(
                              selectedPlan
                            )
                          )}
                        </p>

                        <p className="text-xs text-ink-400">
                          {selectedPlan?.department ||
                            "Department not set"}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="mt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-ink-900">
                      Successor candidates
                    </h3>

                    <span className="text-xs text-ink-400">
                      {
                        getSuccessors(
                          selectedPlan
                        ).length
                      }{" "}
                      candidates
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    {getSuccessors(
                      selectedPlan
                    ).length === 0 ? (
                      <div className="rounded-lg border border-dashed border-ink-200 p-4 text-sm text-ink-400">
                        No candidates have
                        been assigned yet.
                      </div>
                    ) : (
                      getSuccessors(
                        selectedPlan
                      ).map(
                        (successor, index) => {
                          const employee =
                            successor?.employee ||
                            successor;

                          const score =
                            successor?.readiness_score ??
                            successor?.readinessScore ??
                            null;

                          return (
                            <div
                              key={
                                successor?.id ||
                                employee?.id ||
                                index
                              }
                              className="rounded-lg border border-ink-100 p-4"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-3">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-50 text-ink-500">
                                    <UserRound
                                      size={16}
                                    />
                                  </div>

                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-ink-800">
                                      {getEmployeeName(
                                        employee
                                      )}
                                    </p>

                                    {successor?.development_status && (
                                      <p className="text-xs text-ink-400">
                                        {
                                          successor.development_status
                                        }
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {score !==
                                  null && (
                                  <span
                                    className={`rounded-full border px-2 py-1 text-xs font-semibold ${getReadinessClasses(
                                      score
                                    )}`}
                                  >
                                    {score}%
                                  </span>
                                )}
                              </div>

                              {successor?.development_gaps && (
                                <div className="mt-3 rounded-lg bg-canvas p-3">
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">
                                    Development gaps
                                  </p>

                                  <p className="mt-1 text-sm text-ink-600">
                                    {
                                      successor.development_gaps
                                    }
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        }
                      )
                    )}
                  </div>
                </section>

                <section className="mt-6">
                  <h3 className="text-sm font-semibold text-ink-900">
                    Transition planning
                  </h3>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <InfoBox
                      label="Target transition"
                      value={formatDate(
                        selectedPlan?.target_transition_date
                      )}
                    />

                    <InfoBox
                      label="Department"
                      value={
                        selectedPlan?.department ||
                        "Not set"
                      }
                    />
                  </div>
                </section>

                {selectedPlan?.notes && (
                  <section className="mt-6">
                    <h3 className="text-sm font-semibold text-ink-900">
                      Notes
                    </h3>

                    <div className="mt-3 rounded-lg bg-canvas p-4 text-sm leading-6 text-ink-600">
                      {selectedPlan.notes}
                    </div>
                  </section>
                )}
              </div>

              <div className="border-t border-ink-100 px-6 py-4">
                <button
                  type="button"
                  onClick={() => {
                    const plan =
                      selectedPlan;

                    setSelectedPlan(null);
                    openEditForm(plan);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  <Edit3 size={16} />
                  Edit Succession Plan
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* CREATE / EDIT MODAL */}

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Close form"
              onClick={closeForm}
              className="absolute inset-0 bg-black/30"
            />

            <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-ink-100 px-6 py-5">
                <div>
                  <h2 className="text-lg font-semibold text-ink-900">
                    {editingPlan
                      ? "Edit Succession Plan"
                      : "Add Key Role"}
                  </h2>

                  <p className="mt-1 text-sm text-ink-500">
                    Define the role, current holder,
                    criticality and transition readiness.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-lg p-2 text-ink-400 hover:bg-ink-50 hover:text-ink-700 disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>

              <form
                onSubmit={handleSubmit}
                className="min-h-0 flex-1 overflow-y-auto px-6 py-6"
              >
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Field
                    label="Role title"
                    required
                  >
                    <input
                      value={form.role_title}
                      onChange={(event) =>
                        updateForm(
                          "role_title",
                          event.target.value
                        )
                      }
                      placeholder="e.g. Head of Engineering"
                      className="input-field"
                    />
                  </Field>

                  <Field label="Department">
                    <input
                      value={form.department}
                      onChange={(event) =>
                        updateForm(
                          "department",
                          event.target.value
                        )
                      }
                      placeholder="e.g. Engineering"
                      className="input-field"
                    />
                  </Field>

                  <Field label="Current role holder">
                    <select
                      value={
                        form.current_holder_employee_id
                      }
                      onChange={(event) =>
                        updateForm(
                          "current_holder_employee_id",
                          event.target.value
                        )
                      }
                      disabled={loadingEmployees}
                      className="input-field"
                    >
                      <option value="">
                        Select employee
                      </option>

                      {employeeOptions.map(
                        (employee) => (
                          <option
                            key={employee.id}
                            value={employee.id}
                          >
                            {getEmployeeName(
                              employee
                            )}
                          </option>
                        )
                      )}
                    </select>
                  </Field>

                  <Field label="Primary successor">
                    <select
                      value={
                        form.primary_successor_employee_id
                      }
                      onChange={(event) =>
                        updateForm(
                          "primary_successor_employee_id",
                          event.target.value
                        )
                      }
                      disabled={loadingEmployees}
                      className="input-field"
                    >
                      <option value="">
                        Select successor
                      </option>

                      {employeeOptions.map(
                        (employee) => (
                          <option
                            key={employee.id}
                            value={employee.id}
                          >
                            {getEmployeeName(
                              employee
                            )}
                          </option>
                        )
                      )}
                    </select>
                  </Field>

                  <Field label="Criticality">
                    <select
                      value={form.criticality}
                      onChange={(event) =>
                        updateForm(
                          "criticality",
                          event.target.value
                        )
                      }
                      className="input-field"
                    >
                      <option value="critical">
                        Critical
                      </option>
                      <option value="high">
                        High
                      </option>
                      <option value="medium">
                        Medium
                      </option>
                      <option value="low">
                        Low
                      </option>
                    </select>
                  </Field>

                  <Field label="Target transition date">
                    <input
                      type="date"
                      value={
                        form.target_transition_date
                      }
                      onChange={(event) =>
                        updateForm(
                          "target_transition_date",
                          event.target.value
                        )
                      }
                      className="input-field"
                    />
                  </Field>

                  <Field label="Readiness score">
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={
                          form.readiness_score
                        }
                        onChange={(event) =>
                          updateForm(
                            "readiness_score",
                            event.target.value
                          )
                        }
                        className="flex-1"
                      />

                      <span className="w-12 text-right text-sm font-semibold text-ink-900">
                        {form.readiness_score}%
                      </span>
                    </div>
                  </Field>

                  <Field label="Plan title">
                    <input
                      value={form.title}
                      onChange={(event) =>
                        updateForm(
                          "title",
                          event.target.value
                        )
                      }
                      placeholder="Optional"
                      className="input-field"
                    />
                  </Field>

                  <div className="sm:col-span-2">
                    <Field label="Notes">
                      <textarea
                        value={form.notes}
                        onChange={(event) =>
                          updateForm(
                            "notes",
                            event.target.value
                          )
                        }
                        rows={4}
                        placeholder="Add transition context, development priorities or other notes..."
                        className="input-field resize-none"
                      />
                    </Field>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3 border-t border-ink-100 pt-5">
                  <button
                    type="button"
                    onClick={closeForm}
                    disabled={saving}
                    className="rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving && (
                      <Loader2
                        size={16}
                        className="animate-spin"
                      />
                    )}

                    {editingPlan
                      ? "Save Changes"
                      : "Create Plan"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
   SMALL COMPONENTS
============================================================================ */

function MetricCard({
  icon,
  label,
  value,
}) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          {icon}
        </div>

        <span className="text-2xl font-semibold text-ink-900">
          {value}
        </span>
      </div>

      <p className="mt-3 text-sm text-ink-500">
        {label}
      </p>
    </div>
  );
}

function DetailMetric({
  label,
  value,
}) {
  return (
    <div className="rounded-lg border border-ink-100 bg-canvas p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold capitalize text-ink-900">
        {value}
      </p>
    </div>
  );
}

function InfoBox({
  label,
  value,
}) {
  return (
    <div className="rounded-lg border border-ink-100 p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium text-ink-800">
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  required = false,
  children,
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-600">
        {label}
        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </span>

      {children}
    </label>
  );
}