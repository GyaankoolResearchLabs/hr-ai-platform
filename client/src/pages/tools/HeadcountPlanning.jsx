import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  Plus,
  RefreshCw,
  Search,
  Users,
  UserPlus,
  Target,
  TrendingUp,
  Pencil,
  Trash2,
  MoreVertical,
  X,
  CalendarRange,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";

import {
  getHeadcountPlans,
  createHeadcountPlan,
  updateHeadcountPlan,
  deleteHeadcountPlan,
} from "../../services/headcountPlanningService";

import api from "../../services/api";

const STATUS_OPTIONS = [
  {
    value: "Planned",
    label: "Planned",
  },
  {
    value: "Active",
    label: "Active",
  },
  {
    value: "Completed",
    label: "Completed",
  },
  {
    value: "Cancelled",
    label: "Cancelled",
  },
];

const EMPTY_FORM = {
  department: "",
  planning_period: "",
  target_headcount: "",
  status: "Planned",
  notes: "",
};

function normalizePlan(item) {
  return {
    id: item?.id,

    department:
      item?.department ||
      "",

    planning_period:
      item?.planning_period ||
      "",

    target_headcount:
      Number(item?.target_headcount) || 0,

    current_headcount:
      Number(item?.current_headcount) || 0,

    hiring_gap:
      Number(item?.hiring_gap) || 0,

    surplus:
      Number(item?.surplus) || 0,

    status:
      item?.status ||
      "Planned",

    notes:
      item?.notes ||
      "",

    created_at:
      item?.created_at ||
      null,

    updated_at:
      item?.updated_at ||
      null,
  };
}

function getStatusLabel(status) {
  const found = STATUS_OPTIONS.find(
    (option) => option.value === status
  );

  return found?.label || status || "Planned";
}

function formatDate(date) {
  if (!date) return "-";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

export default function HeadcountPlanning() {
  const [plans, setPlans] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [showCreateModal, setShowCreateModal] =
    useState(false);

  const [editingId, setEditingId] =
    useState(null);

  const [openMenu, setOpenMenu] =
    useState(null);

  const [form, setForm] =
    useState(EMPTY_FORM);

  /* =====================================================
     EMPLOYEE MANAGEMENT
  ===================================================== */

  const [employees, setEmployees] =
    useState([]);

  const [employeesLoading, setEmployeesLoading] =
    useState(false);

  const [selectedPlan, setSelectedPlan] =
    useState(null);

  const [selectedEmployeeIds, setSelectedEmployeeIds] =
    useState([]);

  const [employeeSearch, setEmployeeSearch] =
    useState("");

  const [assigningEmployees, setAssigningEmployees] =
    useState(false);

  const [showEmployeesModal, setShowEmployeesModal] =
    useState(false);

  /* =====================================================
     LOAD HEADCOUNT PLANS
  ===================================================== */

  const loadPlans = async () => {
    try {
      setLoading(true);
      setError("");

      const data =
        await getHeadcountPlans();

      setPlans(
        Array.isArray(data)
          ? data.map(normalizePlan)
          : []
      );
    } catch (err) {
      console.error(
        "[HeadcountPlanning] Load failed:",
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to load headcount plans."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  /* =====================================================
     LOAD EMPLOYEES
  ===================================================== */

  const loadEmployees = async () => {
    try {
      setEmployeesLoading(true);

      const response =
        await api.get("/employees");

      const data = response?.data;

      setEmployees(
        Array.isArray(data)
          ? data
          : Array.isArray(data?.employees)
          ? data.employees
          : []
      );
    } catch (err) {
      console.error(
        "[HeadcountPlanning] Employee load failed:",
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to load employees."
      );
    } finally {
      setEmployeesLoading(false);
    }
  };

  const openEmployeesModal = async (plan) => {
    setError("");
    setSuccess("");

    setSelectedPlan(plan);
    setSelectedEmployeeIds([]);
    setEmployeeSearch("");
    setShowEmployeesModal(true);

    await loadEmployees();
  };

  const closeEmployeesModal = () => {
    if (assigningEmployees) return;

    setShowEmployeesModal(false);
    setSelectedPlan(null);
    setSelectedEmployeeIds([]);
    setEmployeeSearch("");
  };

  const toggleEmployeeSelection = (employeeId) => {
    setSelectedEmployeeIds((current) =>
      current.includes(employeeId)
        ? current.filter(
            (id) => id !== employeeId
          )
        : [...current, employeeId]
    );
  };

  const handleAssignEmployees = async () => {
    if (!selectedPlan) return;

    if (selectedEmployeeIds.length === 0) {
      setError(
        "Select at least one employee."
      );
      return;
    }

    try {
      setAssigningEmployees(true);
      setError("");
      setSuccess("");

      const selectedEmployees =
        employees.filter((employee) =>
          selectedEmployeeIds.includes(
            employee.id
          )
        );

      await Promise.all(
        selectedEmployees.map((employee) =>
          api.put(
            `/employees/${employee.id}`,
            {
              full_name:
                employee.full_name || "",

              email:
                employee.email || "",

              department:
                selectedPlan.department,

              title:
                employee.title || null,

              employee_code:
                employee.employee_code ||
                null,

              joining_date:
                employee.joining_date ||
                null,

              employment_status:
                employee.employment_status ||
                "Active",

              last_working_date:
                employee.last_working_date ||
                null,

              address:
                employee.address || null,
            }
          )
        )
      );

      setSuccess(
        `${selectedEmployees.length} employee${
          selectedEmployees.length === 1
            ? ""
            : "s"
        } assigned to ${
          selectedPlan.department
        }.`
      );

      setShowEmployeesModal(false);
      setSelectedPlan(null);
      setSelectedEmployeeIds([]);
      setEmployeeSearch("");

      await loadPlans();
    } catch (err) {
      console.error(
        "[HeadcountPlanning] Employee assignment failed:",
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to assign employees."
      );
    } finally {
      setAssigningEmployees(false);
    }
  };

  /* =====================================================
     FILTER
  ===================================================== */

  const filteredPlans = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return plans.filter((plan) => {
      const matchesSearch =
        !query ||
        plan.department
          .toLowerCase()
          .includes(query) ||
        plan.planning_period
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        plan.status === statusFilter;

      return (
        matchesSearch &&
        matchesStatus
      );
    });
  }, [
    plans,
    search,
    statusFilter,
  ]);

  /* =====================================================
     STATS
  ===================================================== */

  const stats = useMemo(() => {
    const totalPlans =
      plans.length;

    const activePlans =
      plans.filter(
        (plan) =>
          plan.status === "Active"
      ).length;

    const currentHeadcount =
      plans.reduce(
        (total, plan) =>
          total +
          Number(
            plan.current_headcount || 0
          ),
        0
      );

    const totalHiringGap =
      plans.reduce(
        (total, plan) =>
          total +
          Number(
            plan.hiring_gap || 0
          ),
        0
      );

    return {
      totalPlans,
      activePlans,
      currentHeadcount,
      totalHiringGap,
    };
  }, [plans]);

  /* =====================================================
     FORM
  ===================================================== */

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const openCreateModal = () => {
    setError("");
    setSuccess("");
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (plan) => {
    setError("");
    setSuccess("");

    setEditingId(plan.id);

    setForm({
      department:
        plan.department || "",

      planning_period:
        plan.planning_period || "",

      target_headcount:
        String(
          plan.target_headcount ?? ""
        ),

      status:
        plan.status || "Planned",

      notes:
        plan.notes || "",
    });

    setOpenMenu(null);
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    if (saving) return;

    setShowCreateModal(false);
    resetForm();
  };

  const handleFormChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  /* =====================================================
     CREATE / UPDATE
  ===================================================== */

  const handleCreateOrUpdate =
    async (event) => {
      event.preventDefault();

      const department =
        form.department.trim();

      const planningPeriod =
        form.planning_period.trim();

      const targetHeadcount =
        Number(
          form.target_headcount
        );

      if (!department) {
        setError(
          "Department/team is required."
        );
        return;
      }

      if (!planningPeriod) {
        setError(
          "Planning period is required."
        );
        return;
      }

      if (
        !Number.isInteger(
          targetHeadcount
        ) ||
        targetHeadcount < 0
      ) {
        setError(
          "Target headcount must be a non-negative whole number."
        );
        return;
      }

      try {
        setSaving(true);
        setError("");
        setSuccess("");

        const payload = {
          department,

          planning_period:
            planningPeriod,

          target_headcount:
            targetHeadcount,

          status:
            form.status,

          notes:
            form.notes.trim() ||
            null,
        };

        if (editingId) {
          await updateHeadcountPlan(
            editingId,
            payload
          );

          setSuccess(
            "Headcount plan updated successfully."
          );
        } else {
          await createHeadcountPlan(
            payload
          );

          setSuccess(
            "Headcount plan created successfully."
          );
        }

        setShowCreateModal(false);
        resetForm();

        await loadPlans();
      } catch (err) {
        console.error(
          "[HeadcountPlanning] Save failed:",
          err
        );

        setError(
          err?.response?.data?.message ||
            err?.response?.data?.error ||
            "Failed to save headcount plan."
        );
      } finally {
        setSaving(false);
      }
    };

  /* =====================================================
     DELETE
  ===================================================== */

  const handleDelete = async (id) => {
    setOpenMenu(null);

    const confirmed =
      window.confirm(
        "Are you sure you want to delete this headcount plan?"
      );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      await deleteHeadcountPlan(id);

      setSuccess(
        "Headcount plan deleted successfully."
      );

      await loadPlans();
    } catch (err) {
      console.error(
        "[HeadcountPlanning] Delete failed:",
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to delete headcount plan."
      );
    }
  };

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <button
              type="button"
              onClick={() =>
                window.history.back()
              }
              className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-800"
            >
              <ArrowLeft size={16} />
              Back
            </button>

            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <Users size={22} />
              </div>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                  Headcount Planning
                </h1>

                <p className="mt-1 text-sm text-slate-500 sm:text-base">
                  Create and manage live headcount plans by team.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadPlans}
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={17}
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
              onClick={openCreateModal}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800"
            >
              <Plus size={18} />
              New plan
            </button>
          </div>
        </div>

        {/* ALERTS */}

        {error && (
          <div className="mb-5 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="ml-4 text-red-500 hover:text-red-700"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <span>{success}</span>

            <button
              type="button"
              onClick={() =>
                setSuccess("")
              }
              className="ml-4 text-emerald-500 hover:text-emerald-700"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* STATS */}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="TOTAL PLANS"
            value={stats.totalPlans}
            icon={
              <CalendarRange size={19} />
            }
          />

          <StatCard
            label="ACTIVE PLANS"
            value={stats.activePlans}
            icon={
              <CheckCircle2 size={19} />
            }
          />

          <StatCard
            label="CURRENT HEADCOUNT"
            value={formatNumber(
              stats.currentHeadcount
            )}
            icon={
              <Users size={19} />
            }
          />

          <StatCard
            label="TOTAL HIRING GAP"
            value={formatNumber(
              stats.totalHiringGap
            )}
            icon={
              <UserPlus size={19} />
            }
          />
        </div>

        {/* MAIN */}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

          {/* TOOLBAR */}

          <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Team headcount plans
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Compare current employees with planned team capacity.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">

                <div className="relative">
                  <Search
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="text"
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value
                      )
                    }
                    placeholder="Search teams..."
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 sm:w-64"
                  />
                </div>

                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value
                      )
                    }
                    className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-9 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 sm:w-44"
                  >
                    <option value="all">
                      All statuses
                    </option>

                    {STATUS_OPTIONS.map(
                      (option) => (
                        <option
                          key={option.value}
                          value={option.value}
                        >
                          {option.label}
                        </option>
                      )
                    )}
                  </select>

                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>

              </div>
            </div>
          </div>

          {/* CONTENT */}

          {loading ? (
            <div className="flex min-h-[360px] items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <RefreshCw
                  size={18}
                  className="animate-spin"
                />
                Loading headcount plans...
              </div>
            </div>
          ) : filteredPlans.length === 0 ? (
            <EmptyState
              hasPlans={plans.length > 0}
              onCreate={openCreateModal}
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredPlans.map(
                (plan) => (
                  <PlanRow
                    key={plan.id}
                    plan={plan}
                    openMenu={openMenu}
                    setOpenMenu={setOpenMenu}
                    onEdit={
                      openEditModal
                    }
                    onDelete={
                      handleDelete
                    }
                    onManagePeople={
                      openEmployeesModal
                    }
                  />
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}

      {showCreateModal && (
        <Modal
          title={
            editingId
              ? "Edit headcount plan"
              : "Create headcount plan"
          }
          subtitle={
            editingId
              ? "Update the team's workforce target."
              : "Set a workforce target for a team and planning period."
          }
          onClose={
            closeCreateModal
          }
        >
          <form
            onSubmit={
              handleCreateOrUpdate
            }
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

              <FormField
                label="Department / Team"
                name="department"
                value={
                  form.department
                }
                onChange={
                  handleFormChange
                }
                placeholder="e.g. Engineering"
                required
              />

              <FormField
                label="Planning period"
                name="planning_period"
                value={
                  form.planning_period
                }
                onChange={
                  handleFormChange
                }
                placeholder="e.g. 2026 Q4"
                required
              />

              <FormField
                label="Target headcount"
                name="target_headcount"
                type="number"
                min="0"
                value={
                  form.target_headcount
                }
                onChange={
                  handleFormChange
                }
                placeholder="e.g. 25"
                required
              />

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Status
                </label>

                <select
                  name="status"
                  value={
                    form.status
                  }
                  onChange={
                    handleFormChange
                  }
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                >
                  {STATUS_OPTIONS.map(
                    (option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Notes
                </label>

                <textarea
                  name="notes"
                  value={
                    form.notes
                  }
                  onChange={
                    handleFormChange
                  }
                  rows={4}
                  placeholder="Add planning notes..."
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </div>
            </div>

            <ModalFooter
              onCancel={
                closeCreateModal
              }
              loading={saving}
              submitText={
                editingId
                  ? "Update plan"
                  : "Create plan"
              }
            />
          </form>
        </Modal>
      )}

      {/* MANAGE EMPLOYEES MODAL */}

      {showEmployeesModal &&
        selectedPlan && (
          <Modal
            title={`Manage ${selectedPlan.department} employees`}
            subtitle="Assign active employees to this team to update the live headcount."
            onClose={
              closeEmployeesModal
            }
          >
            <div className="space-y-5">

              {/* CURRENT PLAN NUMBERS */}

              <div className="grid grid-cols-3 gap-3">

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-400">
                    Current
                  </p>

                  <p className="mt-1 text-xl font-semibold text-slate-900">
                    {selectedPlan.current_headcount}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-400">
                    Target
                  </p>

                  <p className="mt-1 text-xl font-semibold text-slate-900">
                    {selectedPlan.target_headcount}
                  </p>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-medium text-amber-600">
                    Hiring gap
                  </p>

                  <p className="mt-1 text-xl font-semibold text-amber-700">
                    {selectedPlan.hiring_gap}
                  </p>
                </div>

              </div>

              {/* SEARCH */}

              <div className="relative">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  value={
                    employeeSearch
                  }
                  onChange={(event) =>
                    setEmployeeSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search employees..."
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              {/* EMPLOYEES */}

              {employeesLoading ? (
                <div className="flex min-h-[220px] items-center justify-center">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <RefreshCw
                      size={17}
                      className="animate-spin"
                    />
                    Loading employees...
                  </div>
                </div>
              ) : (
                <EmployeeSelectionList
                  employees={employees}
                  selectedPlan={
                    selectedPlan
                  }
                  search={
                    employeeSearch
                  }
                  selectedEmployeeIds={
                    selectedEmployeeIds
                  }
                  onToggle={
                    toggleEmployeeSelection
                  }
                />
              )}

              {/* FOOTER */}

              <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">

                <p className="text-sm text-slate-500">
                  {
                    selectedEmployeeIds.length
                  }{" "}
                  employee
                  {selectedEmployeeIds.length ===
                  1
                    ? ""
                    : "s"}{" "}
                  selected
                </p>

                <div className="flex items-center gap-3">

                  <button
                    type="button"
                    onClick={
                      closeEmployeesModal
                    }
                    disabled={
                      assigningEmployees
                    }
                    className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={
                      handleAssignEmployees
                    }
                    disabled={
                      assigningEmployees ||
                      selectedEmployeeIds.length ===
                        0
                    }
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {assigningEmployees && (
                      <RefreshCw
                        size={15}
                        className="animate-spin"
                      />
                    )}

                    {assigningEmployees
                      ? "Assigning..."
                      : "Add selected"}
                  </button>

                </div>
              </div>

            </div>
          </Modal>
        )}
    </div>
  );
}

/* =======================================================
   PLAN ROW
======================================================= */

function PlanRow({
  plan,
  openMenu,
  setOpenMenu,
  onEdit,
  onDelete,
  onManagePeople,
}) {
  const gap =
    Number(plan.hiring_gap) || 0;

  const surplus =
    Number(plan.surplus) || 0;

  return (
    <div className="px-5 py-5 transition hover:bg-slate-50/70 sm:px-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

        <div className="min-w-0 flex-1">

          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">
              {plan.department}
            </h3>

            <StatusBadge
              status={
                plan.status
              }
            />
          </div>

          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
            <span>
              Planning period:{" "}
              <span className="font-medium text-slate-700">
                {plan.planning_period}
              </span>
            </span>

            <span>
              Created{" "}
              {formatDate(
                plan.created_at
              )}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">

            <MetricBox
              label="Current"
              value={
                plan.current_headcount
              }
              icon={
                <Users size={15} />
              }
            />

            <MetricBox
              label="Target"
              value={
                plan.target_headcount
              }
              icon={
                <Target size={15} />
              }
            />

            <MetricBox
              label="Hiring gap"
              value={gap}
              danger={
                gap > 0
              }
              icon={
                <TrendingUp
                  size={15}
                />
              }
            />

            <MetricBox
              label="Surplus"
              value={surplus}
              icon={
                <CheckCircle2
                  size={15}
                />
              }
            />

          </div>

          {plan.notes && (
            <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {plan.notes}
            </div>
          )}

          {gap > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              <AlertTriangle size={14} />

              {formatNumber(gap)} additional hire
              {gap === 1 ? "" : "s"} needed
            </div>
          )}

        </div>

        {/* ACTIONS */}

        <div className="flex items-center gap-2 self-start xl:self-center">

          <button
            type="button"
            onClick={() =>
              onManagePeople(plan)
            }
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-4 text-sm font-medium text-teal-700 transition hover:bg-teal-100"
          >
            <UserPlus size={15} />
            Manage people
          </button>

          <button
            type="button"
            onClick={() =>
              onEdit(plan)
            }
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <Pencil size={15} />
            Edit
          </button>

          <div className="relative">

            <button
              type="button"
              onClick={() =>
                setOpenMenu(
                  openMenu === plan.id
                    ? null
                    : plan.id
                )
              }
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
            >
              <MoreVertical
                size={18}
              />
            </button>

            {openMenu === plan.id && (
              <div className="absolute right-0 top-12 z-20 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">

                <button
                  type="button"
                  onClick={() =>
                    onEdit(plan)
                  }
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Pencil
                    size={16}
                  />
                  Edit plan
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onDelete(
                      plan.id
                    )
                  }
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2
                    size={16}
                  />
                  Delete
                </button>

              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}

/* =======================================================
   EMPLOYEE SELECTION LIST
======================================================= */

function EmployeeSelectionList({
  employees,
  selectedPlan,
  search,
  selectedEmployeeIds,
  onToggle,
}) {
  const query =
    search.trim().toLowerCase();

  const availableEmployees =
    employees.filter(
      (employee) => {
        const isActive =
          String(
            employee.employment_status ||
              ""
          ).toLowerCase() ===
          "active";

        const sameDepartment =
          String(
            employee.department || ""
          )
            .trim()
            .toLowerCase() ===
          String(
            selectedPlan.department ||
              ""
          )
            .trim()
            .toLowerCase();

        const matchesSearch =
          !query ||
          String(
            employee.full_name || ""
          )
            .toLowerCase()
            .includes(query) ||
          String(
            employee.email || ""
          )
            .toLowerCase()
            .includes(query) ||
          String(
            employee.title || ""
          )
            .toLowerCase()
            .includes(query) ||
          String(
            employee.department || ""
          )
            .toLowerCase()
            .includes(query);

        return (
          isActive &&
          !sameDepartment &&
          matchesSearch
        );
      }
    );

  if (
    availableEmployees.length ===
    0
  ) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-8 text-center">

        <Users
          size={28}
          className="mx-auto text-slate-400"
        />

        <p className="mt-3 text-sm font-medium text-slate-700">
          No available employees found
        </p>

        <p className="mt-1 text-xs text-slate-500">
          Active employees already assigned to this team are excluded.
        </p>

      </div>
    );
  }

  return (
    <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">

      {availableEmployees.map(
        (employee) => {
          const selected =
            selectedEmployeeIds.includes(
              employee.id
            );

          return (
            <label
              key={employee.id}
              className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() =>
                  onToggle(
                    employee.id
                  )
                }
                className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-500"
              />

              <div className="min-w-0 flex-1">

                <p className="truncate text-sm font-medium text-slate-800">
                  {employee.full_name}
                </p>

                <p className="truncate text-xs text-slate-500">
                  {employee.title ||
                    "No title"}

                  {employee.department
                    ? ` · ${employee.department}`
                    : ""}
                </p>

                <p className="truncate text-xs text-slate-400">
                  {employee.email}
                </p>

              </div>

              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                Active
              </span>

            </label>
          );
        }
      )}

    </div>
  );
}

/* =======================================================
   STAT CARD
======================================================= */

function StatCard({
  label,
  value,
  icon,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">

      <div className="flex items-center justify-between">

        <p className="text-xs font-semibold tracking-wide text-slate-400">
          {label}
        </p>

        <div className="text-slate-400">
          {icon}
        </div>

      </div>

      <p className="mt-5 text-3xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>

    </div>
  );
}

/* =======================================================
   METRIC BOX
======================================================= */

function MetricBox({
  label,
  value,
  icon,
  danger = false,
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">

      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
        {icon}
        {label}
      </div>

      <p
        className={`mt-1 text-lg font-semibold ${
          danger
            ? "text-amber-700"
            : "text-slate-900"
        }`}
      >
        {formatNumber(value)}
      </p>

    </div>
  );
}

/* =======================================================
   STATUS BADGE
======================================================= */

function StatusBadge({
  status,
}) {
  const styles = {
    Planned:
      "border-slate-200 bg-slate-50 text-slate-600",

    Active:
      "border-blue-200 bg-blue-50 text-blue-700",

    Completed:
      "border-emerald-200 bg-emerald-50 text-emerald-700",

    Cancelled:
      "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
        styles[status] ||
        "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      {getStatusLabel(status)}
    </span>
  );
}

/* =======================================================
   EMPTY STATE
======================================================= */

function EmptyState({
  hasPlans,
  onCreate,
}) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">

      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        {hasPlans ? (
          <Search size={25} />
        ) : (
          <Users size={25} />
        )}
      </div>

      <h3 className="mt-4 text-base font-semibold text-slate-800">
        {hasPlans
          ? "No matching plans"
          : "No headcount plans yet"}
      </h3>

      <p className="mt-1 max-w-md text-sm text-slate-500">
        {hasPlans
          ? "Try changing your search or status filter."
          : "Create your first team headcount plan to start tracking workforce capacity."}
      </p>

      {!hasPlans && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
        >
          <Plus size={17} />
          Create plan
        </button>
      )}

    </div>
  );
}

/* =======================================================
   FORM FIELD
======================================================= */

function FormField({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
  min,
}) {
  return (
    <div>

      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        min={min}
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
      />

    </div>
  );
}

/* =======================================================
   MODAL
======================================================= */

function Modal({
  title,
  subtitle,
  children,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">

      <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl">

        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">

          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {title}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {subtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={20} />
          </button>

        </div>

        <div className="max-h-[calc(90vh-90px)] overflow-y-auto px-6 py-6">
          {children}
        </div>

      </div>
    </div>
  );
}

/* =======================================================
   MODAL FOOTER
======================================================= */

function ModalFooter({
  onCancel,
  loading,
  submitText,
}) {
  return (
    <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-5">

      <button
        type="button"
        onClick={onCancel}
        disabled={loading}
        className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
      >
        Cancel
      </button>

      <button
        type="submit"
        disabled={loading}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading && (
          <RefreshCw
            size={15}
            className="animate-spin"
          />
        )}

        {loading
          ? "Saving..."
          : submitText}
      </button>

    </div>
  );
}