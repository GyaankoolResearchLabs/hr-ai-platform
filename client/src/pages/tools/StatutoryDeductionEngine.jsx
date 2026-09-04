import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  Calculator,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Edit3,
  Eye,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

import { api } from "../../services/api.js";

/* =========================================================
   CONSTANTS
========================================================= */

const EMPTY_RULE = {
  name: "",
  code: "",
  description: "",
  countryCode: "",
  regionCode: "",
  deductionType: "employee",
  calculationMethod: "percentage",
  baseComponent: "gross_pay",
  employeeRate: "",
  employerRate: "",
  fixedAmount: "",
  capAmount: "",
  minimumBase: "0",
  effectiveFrom: new Date()
    .toISOString()
    .slice(0, 10),
  effectiveTo: "",
  status: "draft",
  priority: "100",
};

const EMPTY_PREVIEW = {
  calculationBase: "",
};

const METHOD_OPTIONS = [
  {
    value: "percentage",
    label: "Percentage",
  },
  {
    value: "fixed",
    label: "Fixed Amount",
  },
  {
    value: "percentage_capped",
    label: "Percentage with Cap",
  },
  {
    value: "progressive",
    label: "Progressive",
  },
];

const BASE_OPTIONS = [
  {
    value: "base_salary",
    label: "Base Salary",
  },
  {
    value: "gross_pay",
    label: "Gross Pay",
  },
  {
    value: "allowances",
    label: "Allowances",
  },
  {
    value: "overtime_pay",
    label: "Overtime Pay",
  },
  {
    value: "bonus",
    label: "Bonus",
  },
  {
    value: "reimbursements",
    label: "Reimbursements",
  },
  {
    value: "fixed_deductions",
    label: "Fixed Deductions",
  },
  {
    value: "other_deductions",
    label: "Other Deductions",
  },
  {
    value: "net_pay",
    label: "Net Pay",
  },
];

const STATUS_OPTIONS = [
  {
    value: "draft",
    label: "Draft",
  },
  {
    value: "active",
    label: "Active",
  },
  {
    value: "inactive",
    label: "Inactive",
  },
  {
    value: "expired",
    label: "Expired",
  },
];

const PAGE_SIZE = 8;

/* =========================================================
   HELPERS
========================================================= */

function normalizeResponse(response) {
  return (
    response?.data?.data ??
    response?.data ??
    response ??
    null
  );
}

function asArray(value) {
  return Array.isArray(value)
    ? value
    : [];
}

function numberValue(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    },
  ).format(numberValue(value));
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(
    `${String(value).slice(0, 10)}T00:00:00`,
  );

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  );
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  );
}

function getStatusMeta(status) {
  switch (status) {
    case "active":
      return {
        label: "Active",
        className:
          "bg-emerald-50 text-emerald-700 border-emerald-200",
      };

    case "inactive":
      return {
        label: "Inactive",
        className:
          "bg-slate-100 text-slate-700 border-slate-200",
      };

    case "expired":
      return {
        label: "Expired",
        className:
          "bg-rose-50 text-rose-700 border-rose-200",
      };

    default:
      return {
        label: "Draft",
        className:
          "bg-amber-50 text-amber-700 border-amber-200",
      };
  }
}

function getMethodLabel(method) {
  return (
    METHOD_OPTIONS.find(
      (item) =>
        item.value === method,
    )?.label ||
    method ||
    "—"
  );
}

function getBaseLabel(base) {
  return (
    BASE_OPTIONS.find(
      (item) =>
        item.value === base,
    )?.label ||
    base ||
    "—"
  );
}

function getTypeLabel(type) {
  switch (type) {
    case "employee":
      return "Employee";

    case "employer":
      return "Employer";

    case "both":
      return "Employee + Employer";

    default:
      return type || "—";
  }
}

function inputClassName(
  hasError = false,
) {
  return [
    "w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition",
    "bg-white text-slate-900 placeholder:text-slate-400",
    "focus:ring-2 focus:ring-indigo-500/20",
    hasError
      ? "border-rose-300 focus:border-rose-500"
      : "border-slate-200 focus:border-indigo-500",
  ].join(" ");
}

function buttonClassName(
  disabled = false,
  extra = "",
) {
  return [
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition",
    disabled
      ? "cursor-not-allowed opacity-50"
      : "hover:-translate-y-px",
    extra,
  ].join(" ");
}

/* =========================================================
   STATUS BADGE
========================================================= */

function StatusBadge({ status }) {
  const meta =
    getStatusMeta(status);

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        meta.className,
      ].join(" ")}
    >
      {meta.label}
    </span>
  );
}

/* =========================================================
   EMPTY STATE
========================================================= */

function EmptyState({
  title,
  description,
  action,
  onAction,
}) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
        <ShieldCheck className="h-6 w-6 text-slate-500" />
      </div>

      <h3 className="text-base font-semibold text-slate-900">
        {title}
      </h3>

      <p className="mt-1 max-w-md text-sm text-slate-500">
        {description}
      </p>

      {action && (
        <button
          type="button"
          onClick={onAction}
          className={buttonClassName(
            false,
            "mt-5 bg-slate-900 text-white hover:bg-slate-800",
          )}
        >
          <Plus className="h-4 w-4" />
          {action}
        </button>
      )}
    </div>
  );
}

/* =========================================================
   RULE FORM
========================================================= */

function RuleForm({
  form,
  setForm,
  errors,
  saving,
  editing,
  onSubmit,
  onCancel,
  onPreview,
}) {
  const update = (
    field,
    value,
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Rule Name
          </label>

          <input
            value={form.name}
            onChange={(event) =>
              update(
                "name",
                event.target.value,
              )
            }
            placeholder="e.g. Employee Social Contribution"
            className={inputClassName(
              errors.name,
            )}
          />

          {errors.name && (
            <p className="mt-1 text-xs text-rose-600">
              {errors.name}
            </p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Rule Code
          </label>

          <input
            value={form.code}
            onChange={(event) =>
              update(
                "code",
                event.target.value
                  .toUpperCase(),
              )
            }
            placeholder="e.g. SOCIAL_EMPLOYEE"
            className={inputClassName(
              errors.code,
            )}
          />

          {errors.code && (
            <p className="mt-1 text-xs text-rose-600">
              {errors.code}
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Description
        </label>

        <textarea
          value={form.description}
          onChange={(event) =>
            update(
              "description",
              event.target.value,
            )
          }
          rows={3}
          placeholder="Describe what this statutory rule calculates."
          className={inputClassName()}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Country Code
          </label>

          <input
            value={form.countryCode}
            onChange={(event) =>
              update(
                "countryCode",
                event.target.value
                  .toUpperCase(),
              )
            }
            placeholder="IN"
            maxLength={10}
            className={inputClassName()}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Region Code
          </label>

          <input
            value={form.regionCode}
            onChange={(event) =>
              update(
                "regionCode",
                event.target.value
                  .toUpperCase(),
              )
            }
            placeholder="KA"
            maxLength={20}
            className={inputClassName()}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Priority
          </label>

          <input
            type="number"
            min="0"
            value={form.priority}
            onChange={(event) =>
              update(
                "priority",
                event.target.value,
              )
            }
            className={inputClassName()}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Calculation Configuration
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Configure how the deduction is calculated.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Deduction Type
            </label>

            <div className="relative">
              <select
                value={
                  form.deductionType
                }
                onChange={(event) =>
                  update(
                    "deductionType",
                    event.target.value,
                  )
                }
                className={`${inputClassName()} appearance-none pr-9`}
              >
                <option value="employee">
                  Employee
                </option>

                <option value="employer">
                  Employer
                </option>

                <option value="both">
                  Employee + Employer
                </option>
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Calculation Method
            </label>

            <div className="relative">
              <select
                value={
                  form.calculationMethod
                }
                onChange={(event) =>
                  update(
                    "calculationMethod",
                    event.target.value,
                  )
                }
                className={`${inputClassName()} appearance-none pr-9`}
              >
                {METHOD_OPTIONS.map(
                  (option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ),
                )}
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Calculation Base
            </label>

            <div className="relative">
              <select
                value={
                  form.baseComponent
                }
                onChange={(event) =>
                  update(
                    "baseComponent",
                    event.target.value,
                  )
                }
                className={`${inputClassName()} appearance-none pr-9`}
              >
                {BASE_OPTIONS.map(
                  (option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ),
                )}
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {(form.calculationMethod ===
            "percentage" ||
            form.calculationMethod ===
              "percentage_capped") && (
            <>
              {(form.deductionType ===
                "employee" ||
                form.deductionType ===
                  "both") && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Employee Rate (%)
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.00001"
                    value={
                      form.employeeRate
                    }
                    onChange={(event) =>
                      update(
                        "employeeRate",
                        event.target.value,
                      )
                    }
                    placeholder="0"
                    className={inputClassName(
                      errors.employeeRate,
                    )}
                  />

                  {errors.employeeRate && (
                    <p className="mt-1 text-xs text-rose-600">
                      {
                        errors.employeeRate
                      }
                    </p>
                  )}
                </div>
              )}

              {(form.deductionType ===
                "employer" ||
                form.deductionType ===
                  "both") && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Employer Rate (%)
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.00001"
                    value={
                      form.employerRate
                    }
                    onChange={(event) =>
                      update(
                        "employerRate",
                        event.target.value,
                      )
                    }
                    placeholder="0"
                    className={inputClassName(
                      errors.employerRate,
                    )}
                  />

                  {errors.employerRate && (
                    <p className="mt-1 text-xs text-rose-600">
                      {
                        errors.employerRate
                      }
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {form.calculationMethod ===
            "fixed" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Fixed Amount
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  form.fixedAmount
                }
                onChange={(event) =>
                  update(
                    "fixedAmount",
                    event.target.value,
                  )
                }
                placeholder="0.00"
                className={inputClassName(
                  errors.fixedAmount,
                )}
              />

              {errors.fixedAmount && (
                <p className="mt-1 text-xs text-rose-600">
                  {errors.fixedAmount}
                </p>
              )}
            </div>
          )}

          {form.calculationMethod ===
            "percentage_capped" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Maximum Base
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  form.capAmount
                }
                onChange={(event) =>
                  update(
                    "capAmount",
                    event.target.value,
                  )
                }
                placeholder="0.00"
                className={inputClassName(
                  errors.capAmount,
                )}
              />

              {errors.capAmount && (
                <p className="mt-1 text-xs text-rose-600">
                  {errors.capAmount}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Minimum Base
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              value={
                form.minimumBase
              }
              onChange={(event) =>
                update(
                  "minimumBase",
                  event.target.value,
                )
              }
              placeholder="0.00"
              className={inputClassName()}
            />
          </div>
        </div>
      </div>

      {form.calculationMethod ===
        "progressive" && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />

            <div>
              <p className="text-sm font-semibold text-indigo-900">
                Progressive brackets
              </p>

              <p className="mt-1 text-xs leading-5 text-indigo-700">
                Progressive bracket configuration is stored in the
                rule's advanced configuration. The backend validates
                and calculates the brackets.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Effective Period
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Rules are selected according to their effective dates.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Effective From
            </label>

            <input
              type="date"
              value={
                form.effectiveFrom
              }
              onChange={(event) =>
                update(
                  "effectiveFrom",
                  event.target.value,
                )
              }
              className={inputClassName(
                errors.effectiveFrom,
              )}
            />

            {errors.effectiveFrom && (
              <p className="mt-1 text-xs text-rose-600">
                {
                  errors.effectiveFrom
                }
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Effective To
              <span className="ml-1 font-normal text-slate-400">
                optional
              </span>
            </label>

            <input
              type="date"
              value={
                form.effectiveTo
              }
              onChange={(event) =>
                update(
                  "effectiveTo",
                  event.target.value,
                )
              }
              className={inputClassName(
                errors.effectiveTo,
              )}
            />

            {errors.effectiveTo && (
              <p className="mt-1 text-xs text-rose-600">
                {errors.effectiveTo}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className={buttonClassName(
            saving,
            "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
          )}
        >
          <X className="h-4 w-4" />
          Cancel
        </button>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onPreview}
            disabled={saving}
            className={buttonClassName(
              saving,
              "border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
            )}
          >
            <Calculator className="h-4 w-4" />
            Preview
          </button>

          <button
            type="submit"
            disabled={saving}
            className={buttonClassName(
              saving,
              "bg-slate-900 text-white hover:bg-slate-800",
            )}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}

            {editing
              ? "Update Rule"
              : "Create Rule"}
          </button>
        </div>
      </div>
    </form>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function StatutoryDeductionEngine() {
  const navigate =
    useNavigate();

  const [rules, setRules] =
    useState([]);

  const [payrollRuns, setPayrollRuns] =
    useState([]);

  const [selectedRun, setSelectedRun] =
    useState(null);

  const [breakdown, setBreakdown] =
    useState([]);

  const [summary, setSummary] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [runsLoading, setRunsLoading] =
    useState(false);

  const [breakdownLoading, setBreakdownLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [calculating, setCalculating] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState(null);

  const [showRuleForm, setShowRuleForm] =
    useState(false);

  const [showPreview, setShowPreview] =
    useState(false);

  const [editingRule, setEditingRule] =
    useState(null);

  const [form, setForm] =
    useState(EMPTY_RULE);

  const [formErrors, setFormErrors] =
    useState({});

  const [previewInput, setPreviewInput] =
    useState(EMPTY_PREVIEW);

  const [previewResult, setPreviewResult] =
    useState(null);

  const [previewLoading, setPreviewLoading] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [currentPage, setCurrentPage] =
    useState(1);

  /* =======================================================
     LOAD RULES
  ======================================================= */

  const loadRules = useCallback(
    async () => {
      try {
        setLoading(true);

        const response =
          await api.get(
            "/statutory-deductions/rules",
          );

        const data =
          normalizeResponse(
            response,
          );

        setRules(
          asArray(data),
        );
      } catch (error) {
        console.error(
          "Load statutory rules error:",
          error,
        );

        toast.error(
          error?.response?.data?.message ||
            "Could not load statutory deduction rules.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /* =======================================================
     LOAD PAYROLL RUNS
  ======================================================= */

  const loadPayrollRuns =
    useCallback(
      async () => {
        try {
          setRunsLoading(true);

          const response =
            await api.get(
              "/payroll-runs",
            );

          const data =
            normalizeResponse(
              response,
            );

          let runs = [];

          if (Array.isArray(data)) {
            runs = data;
          } else if (
            Array.isArray(
              data?.runs,
            )
          ) {
            runs = data.runs;
          } else if (
            Array.isArray(
              data?.data,
            )
          ) {
            runs = data.data;
          }

          setPayrollRuns(runs);
        } catch (error) {
          console.error(
            "Load payroll runs error:",
            error,
          );

          toast.error(
            error?.response?.data?.message ||
              "Could not load payroll runs.",
          );
        } finally {
          setRunsLoading(false);
        }
      },
      [],
    );

  /* =======================================================
     LOAD BREAKDOWN
  ======================================================= */

  const loadBreakdown =
    useCallback(
      async (runId) => {
        if (!runId) {
          setBreakdown([]);
          setSummary(null);
          return;
        }

        try {
          setBreakdownLoading(true);

          const [
            breakdownResponse,
            summaryResponse,
          ] = await Promise.all([
            api.get(
              `/statutory-deductions/payroll-runs/${runId}`,
            ),

            api.get(
              `/statutory-deductions/payroll-runs/${runId}/summary`,
            ),
          ]);

          const breakdownData =
            normalizeResponse(
              breakdownResponse,
            );

          const summaryData =
            normalizeResponse(
              summaryResponse,
            );

          setBreakdown(
            asArray(
              breakdownData,
            ),
          );

          setSummary(
            summaryData || null,
          );
        } catch (error) {
          console.error(
            "Load statutory breakdown error:",
            error,
          );

          toast.error(
            error?.response?.data?.message ||
              "Could not load statutory deduction breakdown.",
          );
        } finally {
          setBreakdownLoading(false);
        }
      },
      [],
    );

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    loadRules();
    loadPayrollRuns();
  }, [
    loadRules,
    loadPayrollRuns,
  ]);

  /* =======================================================
     FILTERED RULES
  ======================================================= */

  const filteredRules =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return rules.filter(
        (rule) => {
          const matchesSearch =
            !query ||
            [
              rule.name,
              rule.code,
              rule.description,
              rule.country_code,
              rule.region_code,
            ]
              .filter(Boolean)
              .some((value) =>
                String(value)
                  .toLowerCase()
                  .includes(query),
              );

          const matchesStatus =
            statusFilter === "all" ||
            rule.status ===
              statusFilter;

          return (
            matchesSearch &&
            matchesStatus
          );
        },
      );
    }, [
      rules,
      search,
      statusFilter,
    ]);

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredRules.length /
          PAGE_SIZE,
      ),
    );

  const paginatedRules =
    useMemo(() => {
      const start =
        (currentPage - 1) *
        PAGE_SIZE;

      return filteredRules.slice(
        start,
        start + PAGE_SIZE,
      );
    }, [
      filteredRules,
      currentPage,
    ]);

  useEffect(() => {
    if (
      currentPage >
      totalPages
    ) {
      setCurrentPage(
        totalPages,
      );
    }
  }, [
    currentPage,
    totalPages,
  ]);

  /* =======================================================
     RULE FORM
  ======================================================= */

  function openCreateForm() {
    setEditingRule(null);

    setForm({
      ...EMPTY_RULE,

      effectiveFrom:
        new Date()
          .toISOString()
          .slice(0, 10),
    });

    setFormErrors({});

    setShowRuleForm(true);
  }

  function openEditForm(rule) {
    setEditingRule(rule);

    setForm({
      name:
        rule.name || "",

      code:
        rule.code || "",

      description:
        rule.description || "",

      countryCode:
        rule.country_code || "",

      regionCode:
        rule.region_code || "",

      deductionType:
        rule.deduction_type ||
        "employee",

      calculationMethod:
        rule.calculation_method ||
        "percentage",

      baseComponent:
        rule.base_component ||
        "gross_pay",

      employeeRate:
        rule.employee_rate ??
        "",

      employerRate:
        rule.employer_rate ??
        "",

      fixedAmount:
        rule.fixed_amount ??
        "",

      capAmount:
        rule.cap_amount ??
        "",

      minimumBase:
        rule.minimum_base ??
        "0",

      effectiveFrom:
        rule.effective_from ||
        "",

      effectiveTo:
        rule.effective_to ||
        "",

      status:
        rule.status ||
        "draft",

      priority:
        rule.priority ??
        "100",
    });

    setFormErrors({});

    setShowRuleForm(true);
  }

  function closeRuleForm() {
    if (saving) {
      return;
    }

    setShowRuleForm(false);
    setEditingRule(null);
    setFormErrors({});
  }

  function validateForm() {
    const errors = {};

    if (!form.name.trim()) {
      errors.name =
        "Rule name is required.";
    }

    if (!form.code.trim()) {
      errors.code =
        "Rule code is required.";
    } else if (
      !/^[A-Z0-9][A-Z0-9_.-]*$/i.test(
        form.code.trim(),
      )
    ) {
      errors.code =
        "Use letters, numbers, dots, underscores, or hyphens only.";
    }

    if (
      !form.effectiveFrom
    ) {
      errors.effectiveFrom =
        "Effective from is required.";
    }

    if (
      form.effectiveTo &&
      form.effectiveFrom &&
      form.effectiveTo <
        form.effectiveFrom
    ) {
      errors.effectiveTo =
        "Effective to cannot be before effective from.";
    }

    if (
      form.calculationMethod ===
        "fixed" &&
      form.fixedAmount === ""
    ) {
      errors.fixedAmount =
        "Fixed amount is required.";
    }

    if (
      [
        "percentage",
        "percentage_capped",
      ].includes(
        form.calculationMethod,
      )
    ) {
      const needsEmployee =
        form.deductionType ===
          "employee" ||
        form.deductionType ===
          "both";

      const needsEmployer =
        form.deductionType ===
          "employer" ||
        form.deductionType ===
          "both";

      if (
        needsEmployee &&
        form.employeeRate === ""
      ) {
        errors.employeeRate =
          "Employee rate is required.";
      }

      if (
        needsEmployer &&
        form.employerRate === ""
      ) {
        errors.employerRate =
          "Employer rate is required.";
      }
    }

    if (
      form.calculationMethod ===
        "percentage_capped" &&
      form.capAmount === ""
    ) {
      errors.capAmount =
        "Maximum base is required for a capped rule.";
    }

    setFormErrors(errors);

    return (
      Object.keys(errors)
        .length === 0
    );
  }

  function buildRulePayload() {
    const payload = {
      name:
        form.name.trim(),

      code:
        form.code
          .trim()
          .toUpperCase(),

      description:
        form.description.trim() ||
        null,

      countryCode:
        form.countryCode
          .trim()
          .toUpperCase() ||
        null,

      regionCode:
        form.regionCode
          .trim()
          .toUpperCase() ||
        null,

      deductionType:
        form.deductionType,

      calculationMethod:
        form.calculationMethod,

      baseComponent:
        form.baseComponent,

      employeeRate:
        form.employeeRate === ""
          ? null
          : numberValue(
              form.employeeRate,
            ),

      employerRate:
        form.employerRate === ""
          ? null
          : numberValue(
              form.employerRate,
            ),

      fixedAmount:
        form.fixedAmount === ""
          ? null
          : numberValue(
              form.fixedAmount,
            ),

      capAmount:
        form.capAmount === ""
          ? null
          : numberValue(
              form.capAmount,
            ),

      minimumBase:
        numberValue(
          form.minimumBase,
        ),

      brackets:
        editingRule?.brackets ||
        [],

      eligibilityRules:
        editingRule?.eligibility_rules ||
        {},

      configuration:
        editingRule?.configuration ||
        {},

      effectiveFrom:
        form.effectiveFrom,

      effectiveTo:
        form.effectiveTo ||
        null,

      status:
        form.status,

      priority:
        numberValue(
          form.priority,
        ),
    };

    return payload;
  }

  /* =======================================================
     CREATE / UPDATE RULE
  ======================================================= */

  async function handleSaveRule(
    event,
  ) {
    event.preventDefault();

    if (!validateForm()) {
      toast.error(
        "Please correct the highlighted fields.",
      );

      return;
    }

    try {
      setSaving(true);

      const payload =
        buildRulePayload();

      let response;

      if (editingRule?.id) {
        response =
          await api.patch(
            `/statutory-deductions/rules/${editingRule.id}`,
            payload,
          );
      } else {
        response =
          await api.post(
            "/statutory-deductions/rules",
            payload,
          );
      }

      const savedRule =
        normalizeResponse(
          response,
        );

      if (savedRule) {
        if (editingRule?.id) {
          setRules(
            (previous) =>
              previous.map(
                (rule) =>
                  rule.id ===
                  editingRule.id
                    ? savedRule
                    : rule,
              ),
          );
        } else {
          setRules(
            (previous) => [
              savedRule,
              ...previous,
            ],
          );
        }
      } else {
        await loadRules();
      }

      toast.success(
        editingRule?.id
          ? "Statutory rule updated successfully."
          : "Statutory rule created successfully.",
      );

      closeRuleForm();
    } catch (error) {
      console.error(
        "Save statutory rule error:",
        error,
      );

      toast.error(
        error?.response?.data?.message ||
          "Could not save statutory rule.",
      );
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     DELETE RULE
  ======================================================= */

  async function handleDeleteRule(
    rule,
  ) {
    if (!rule?.id) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete "${rule.name}"?\n\nRules already used by payroll cannot be deleted.`,
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(
        rule.id,
      );

      await api.delete(
        `/statutory-deductions/rules/${rule.id}`,
      );

      setRules(
        (previous) =>
          previous.filter(
            (item) =>
              item.id !==
              rule.id,
          ),
      );

      toast.success(
        "Statutory rule deleted successfully.",
      );
    } catch (error) {
      console.error(
        "Delete statutory rule error:",
        error,
      );

      toast.error(
        error?.response?.data?.message ||
          "Could not delete statutory rule.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  /* =======================================================
     TOGGLE ACTIVE STATUS
  ======================================================= */

  async function handleToggleStatus(
    rule,
  ) {
    if (!rule?.id) {
      return;
    }

    const nextStatus =
      rule.status ===
      "active"
        ? "inactive"
        : "active";

    try {
      setDeletingId(
        `status-${rule.id}`,
      );

      const response =
        await api.patch(
          `/statutory-deductions/rules/${rule.id}`,
          {
            ...rule,

            deductionType:
              rule.deduction_type,

            calculationMethod:
              rule.calculation_method,

            baseComponent:
              rule.base_component,

            employeeRate:
              rule.employee_rate,

            employerRate:
              rule.employer_rate,

            fixedAmount:
              rule.fixed_amount,

            capAmount:
              rule.cap_amount,

            minimumBase:
              rule.minimum_base,

            brackets:
              rule.brackets || [],

            eligibilityRules:
              rule.eligibility_rules ||
              {},

            configuration:
              rule.configuration ||
              {},

            effectiveFrom:
              rule.effective_from,

            effectiveTo:
              rule.effective_to,

            countryCode:
              rule.country_code,

            regionCode:
              rule.region_code,

            status:
              nextStatus,

            priority:
              rule.priority,
          },
        );

      const updated =
        normalizeResponse(
          response,
        );

      setRules(
        (previous) =>
          previous.map(
            (item) =>
              item.id ===
              rule.id
                ? updated || {
                    ...item,
                    status:
                      nextStatus,
                  }
                : item,
          ),
      );

      toast.success(
        nextStatus === "active"
          ? "Rule activated."
          : "Rule deactivated.",
      );
    } catch (error) {
      console.error(
        "Toggle statutory rule status error:",
        error,
      );

      toast.error(
        error?.response?.data?.message ||
          "Could not update rule status.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  /* =======================================================
     PREVIEW
  ======================================================= */

  async function handlePreview() {
    if (!validateForm()) {
      toast.error(
        "Correct the rule configuration before previewing.",
      );

      return;
    }

    if (
      previewInput.calculationBase ===
      ""
    ) {
      toast.error(
        "Enter a calculation base for the preview.",
      );

      return;
    }

    try {
      setPreviewLoading(true);

      const response =
        await api.post(
          "/statutory-deductions/preview",
          {
            rule:
              buildRulePayload(),

            calculationBase:
              numberValue(
                previewInput.calculationBase,
              ),
          },
        );

      setPreviewResult(
        normalizeResponse(
          response,
        ),
      );

      setShowPreview(true);
    } catch (error) {
      console.error(
        "Preview statutory rule error:",
        error,
      );

      toast.error(
        error?.response?.data?.message ||
          "Could not preview statutory deduction.",
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  /* =======================================================
     SELECT PAYROLL RUN
  ======================================================= */

  async function handleSelectRun(
    run,
  ) {
    setSelectedRun(run);

    await loadBreakdown(
      run?.id,
    );
  }

  /* =======================================================
     CALCULATE PAYROLL RUN
  ======================================================= */

  async function handleCalculateRun() {
    if (!selectedRun?.id) {
      toast.error(
        "Select a payroll run first.",
      );

      return;
    }

    const confirmed =
      window.confirm(
        "Calculate statutory deductions for this payroll run?\n\nExisting statutory calculation records for this run will be replaced with the new calculation.",
      );

    if (!confirmed) {
      return;
    }

    try {
      setCalculating(true);

      const response =
        await api.post(
          `/statutory-deductions/payroll-runs/${selectedRun.id}/calculate`,
        );

      const result =
        normalizeResponse(
          response,
        );

      toast.success(
        "Statutory deductions calculated successfully.",
      );

      await Promise.all([
        loadPayrollRuns(),
        loadBreakdown(
          selectedRun.id,
        ),
      ]);

      if (
        result?.payroll_run
      ) {
        setSelectedRun(
          result.payroll_run,
        );
      }
    } catch (error) {
      console.error(
        "Calculate payroll statutory deductions error:",
        error,
      );

      toast.error(
        error?.response?.data?.message ||
          "Could not calculate statutory deductions.",
      );
    } finally {
      setCalculating(false);
    }
  }

  /* =======================================================
     SUMMARY CARDS
  ======================================================= */

  const activeRules =
    rules.filter(
      (rule) =>
        rule.status ===
        "active",
    ).length;

  const draftRules =
    rules.filter(
      (rule) =>
        rule.status ===
        "draft",
    ).length;

  const employeeTotal =
    numberValue(
      summary?.employee_total,
    );

  const employerTotal =
    numberValue(
      summary?.employer_total,
    );

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="min-w-0 space-y-6 pb-10">
      {/* ===================================================
          HEADER
      =================================================== */}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() =>
              navigate(-1)
            }
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
            </div>

            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                Statutory Deduction Engine
              </h1>

              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                Configure effective-dated statutory payroll
                deductions and apply them directly to payroll runs.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              loadRules();
              loadPayrollRuns();

              if (
                selectedRun?.id
              ) {
                loadBreakdown(
                  selectedRun.id,
                );
              }
            }}
            disabled={
              loading ||
              runsLoading ||
              breakdownLoading
            }
            className={buttonClassName(
              loading ||
                runsLoading ||
                breakdownLoading,
              "border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50",
            )}
          >
            <RefreshCw
              className={[
                "h-4 w-4",
                loading ||
                runsLoading ||
                breakdownLoading
                  ? "animate-spin"
                  : "",
              ].join(" ")}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={openCreateForm}
            className={buttonClassName(
              false,
              "bg-slate-900 text-white shadow-sm hover:bg-slate-800",
            )}
          >
            <Plus className="h-4 w-4" />
            Add Statutory Rule
          </button>
        </div>
      </div>

      {/* ===================================================
          SUMMARY
      =================================================== */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">
              Total Rules
            </span>

            <FileText className="h-4 w-4 text-slate-400" />
          </div>

          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {rules.length}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Configured for this organization
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">
              Active Rules
            </span>

            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>

          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {activeRules}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Available for payroll calculations
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">
              Draft Rules
            </span>

            <Edit3 className="h-4 w-4 text-amber-500" />
          </div>

          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {draftRules}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Not yet active for calculations
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">
              Current Employee Deductions
            </span>

            <Calculator className="h-4 w-4 text-indigo-500" />
          </div>

          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {formatCurrency(
              employeeTotal,
            )}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Selected payroll run
          </p>
        </div>
      </div>

      {/* ===================================================
          RULE MANAGEMENT
      =================================================== */}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Statutory Rules
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Manage the organization's effective-dated deduction rules.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(
                      event.target.value,
                    );

                    setCurrentPage(
                      1,
                    );
                  }}
                  placeholder="Search rules..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 sm:w-64"
                />
              </div>

              <div className="relative">
                <select
                  value={
                    statusFilter
                  }
                  onChange={(event) => {
                    setStatusFilter(
                      event.target.value,
                    );

                    setCurrentPage(
                      1,
                    );
                  }}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-9 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 sm:w-36"
                >
                  <option value="all">
                    All Statuses
                  </option>

                  {STATUS_OPTIONS.map(
                    (option) => (
                      <option
                        key={
                          option.value
                        }
                        value={
                          option.value
                        }
                      >
                        {option.label}
                      </option>
                    ),
                  )}
                </select>

                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading statutory rules...
            </div>
          </div>
        ) : filteredRules.length ===
          0 ? (
          <div className="p-5">
            <EmptyState
              title={
                rules.length ===
                0
                  ? "No statutory rules configured"
                  : "No matching rules"
              }
              description={
                rules.length ===
                0
                  ? "Create your first configurable statutory deduction rule to start applying statutory calculations to payroll runs."
                  : "Try changing the search term or status filter."
              }
              action={
                rules.length ===
                0
                  ? "Create First Rule"
                  : null
              }
              onAction={
                openCreateForm
              }
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-left">
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Rule
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Type
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Calculation
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Jurisdiction
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Effective
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>

                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedRules.map(
                    (rule) => (
                      <tr
                        key={rule.id}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
                      >
                        <td className="px-5 py-4">
                          <div>
                            <p className="font-medium text-slate-900">
                              {rule.name ||
                                "Unnamed rule"}
                            </p>

                            <p className="mt-1 font-mono text-xs text-slate-400">
                              {rule.code ||
                                "—"}
                            </p>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {getTypeLabel(
                            rule.deduction_type,
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-slate-700">
                            {getMethodLabel(
                              rule.calculation_method,
                            )}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {getBaseLabel(
                              rule.base_component,
                            )}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <div className="text-sm text-slate-600">
                            {rule.country_code ||
                            rule.region_code ? (
                              <span>
                                {rule.country_code ||
                                  "Global"}

                                {rule.region_code
                                  ? ` · ${rule.region_code}`
                                  : ""}
                              </span>
                            ) : (
                              "Global"
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <p className="text-sm text-slate-600">
                            {formatDate(
                              rule.effective_from,
                            )}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {rule.effective_to
                              ? `to ${formatDate(
                                  rule.effective_to,
                                )}`
                              : "No end date"}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge
                            status={
                              rule.status
                            }
                          />
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                openEditForm(
                                  rule,
                                )
                              }
                              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                              title="Edit rule"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleToggleStatus(
                                  rule,
                                )
                              }
                              disabled={
                                deletingId ===
                                `status-${rule.id}`
                              }
                              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                              title={
                                rule.status ===
                                "active"
                                  ? "Deactivate rule"
                                  : "Activate rule"
                              }
                            >
                              {deletingId ===
                              `status-${rule.id}` ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteRule(
                                  rule,
                                )
                              }
                              disabled={
                                deletingId ===
                                rule.id
                              }
                              className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                              title="Delete rule"
                            >
                              {deletingId ===
                              rule.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
                <p className="text-xs text-slate-500">
                  Showing{" "}
                  {Math.min(
                    filteredRules.length,
                    (currentPage -
                      1) *
                      PAGE_SIZE +
                      1,
                  )}
                  –
                  {Math.min(
                    filteredRules.length,
                    currentPage *
                      PAGE_SIZE,
                  )}{" "}
                  of{" "}
                  {
                    filteredRules.length
                  }
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage(
                        (page) =>
                          Math.max(
                            1,
                            page - 1,
                          ),
                      )
                    }
                    disabled={
                      currentPage ===
                      1
                    }
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-40"
                  >
                    Previous
                  </button>

                  <span className="text-xs text-slate-500">
                    Page{" "}
                    {currentPage}{" "}
                    of{" "}
                    {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage(
                        (page) =>
                          Math.min(
                            totalPages,
                            page + 1,
                          ),
                      )
                    }
                    disabled={
                      currentPage ===
                      totalPages
                    }
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ===================================================
          PAYROLL CALCULATION
      =================================================== */}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Payroll Statutory Calculation
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Select an existing payroll run and calculate its
                statutory deductions using the active rules.
              </p>
            </div>

            <button
              type="button"
              onClick={
                handleCalculateRun
              }
              disabled={
                !selectedRun?.id ||
                calculating ||
                breakdownLoading
              }
              className={buttonClassName(
                !selectedRun?.id ||
                  calculating ||
                  breakdownLoading,
                "bg-indigo-600 text-white hover:bg-indigo-700",
              )}
            >
              {calculating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4" />
              )}

              Calculate Deductions
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 p-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          {/* RUN LIST */}

          <div className="min-w-0">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">
                Payroll Runs
              </h3>

              {runsLoading && (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              )}
            </div>

            {payrollRuns.length ===
            0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center">
                <p className="text-sm font-medium text-slate-700">
                  No payroll runs found
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Create a payroll run first using the Payroll Run Engine.
                </p>
              </div>
            ) : (
              <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
                {payrollRuns.map(
                  (run) => {
                    const selected =
                      selectedRun?.id ===
                      run.id;

                    return (
                      <button
                        key={run.id}
                        type="button"
                        onClick={() =>
                          handleSelectRun(
                            run,
                          )
                        }
                        className={[
                          "w-full rounded-xl border p-4 text-left transition",
                          selected
                            ? "border-indigo-300 bg-indigo-50/60 shadow-sm"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                        ].join(
                          " ",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {run.payroll_month
                                ? formatDate(
                                    run.payroll_month,
                                  )
                                : "Payroll Run"}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {numberValue(
                                run.employee_count,
                              )}{" "}
                              employees
                            </p>
                          </div>

                          <StatusBadge
                            status={
                              run.status
                            }
                          />
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-400">
                              Gross
                            </p>

                            <p className="mt-1 text-xs font-medium text-slate-700">
                              {formatCurrency(
                                run.gross_pay,
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-400">
                              Net
                            </p>

                            <p className="mt-1 text-xs font-medium text-slate-700">
                              {formatCurrency(
                                run.net_pay,
                              )}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  },
                )}
              </div>
            )}
          </div>

          {/* CALCULATION DETAILS */}

          <div className="min-w-0">
            {!selectedRun ? (
              <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 text-center">
                <div>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
                    <Calculator className="h-5 w-5 text-slate-400" />
                  </div>

                  <p className="mt-4 text-sm font-medium text-slate-700">
                    Select a payroll run
                  </p>

                  <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
                    Select a payroll run from the left to view
                    statutory deductions and calculate updated
                    payroll totals.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* SELECTED RUN */}

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        Selected Payroll Run
                      </p>

                      <p className="mt-1 text-base font-semibold text-slate-900">
                        {selectedRun.payroll_month
                          ? formatDate(
                              selectedRun.payroll_month,
                            )
                          : "Payroll Run"}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Created{" "}
                        {formatDateTime(
                          selectedRun.created_at,
                        )}
                      </p>
                    </div>

                    <StatusBadge
                      status={
                        selectedRun.status
                      }
                    />
                  </div>
                </div>

                {/* TOTALS */}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs text-slate-500">
                      Employee Deductions
                    </p>

                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {formatCurrency(
                        employeeTotal,
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs text-slate-500">
                      Employer Contributions
                    </p>

                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {formatCurrency(
                        employerTotal,
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs text-slate-500">
                      Calculations
                    </p>

                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {numberValue(
                        summary?.deduction_count,
                      )}
                    </p>
                  </div>
                </div>

                {/* BREAKDOWN */}

                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800">
                          Deduction Breakdown
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                          Persisted statutory calculation results.
                        </p>
                      </div>

                      {breakdownLoading && (
                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                      )}
                    </div>
                  </div>

                  {breakdownLoading ? (
                    <div className="flex min-h-[220px] items-center justify-center">
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading calculation...
                      </div>
                    </div>
                  ) : breakdown.length ===
                    0 ? (
                    <div className="px-5 py-12 text-center">
                      <Calculator className="mx-auto h-6 w-6 text-slate-300" />

                      <p className="mt-3 text-sm font-medium text-slate-700">
                        No statutory deductions calculated
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Click "Calculate Deductions" to apply the
                        active rules to this payroll run.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-[900px] w-full">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/60 text-left">
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Rule
                            </th>

                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Employee
                            </th>

                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Base
                            </th>

                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Employee
                            </th>

                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Employer
                            </th>

                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Calculated
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {breakdown.map(
                            (row) => {
                              const rule =
                                row.statutory_deduction_rules ||
                                {};

                              return (
                                <tr
                                  key={
                                    row.id
                                  }
                                  className="border-b border-slate-100 last:border-0"
                                >
                                  <td className="px-4 py-3">
                                    <p className="text-sm font-medium text-slate-800">
                                      {rule.name ||
                                        row.rule_snapshot
                                          ?.name ||
                                        "Unknown Rule"}
                                    </p>

                                    <p className="mt-1 font-mono text-[11px] text-slate-400">
                                      {rule.code ||
                                        row.rule_snapshot
                                          ?.code ||
                                        "—"}
                                    </p>
                                  </td>

                                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                                    {String(
                                      row.employee_id,
                                    ).slice(
                                      0,
                                      8,
                                    )}
                                    ...
                                  </td>

                                  <td className="px-4 py-3 text-sm text-slate-600">
                                    {formatCurrency(
                                      row.calculation_base,
                                    )}
                                  </td>

                                  <td className="px-4 py-3 text-sm font-medium text-slate-800">
                                    {formatCurrency(
                                      row.employee_amount,
                                    )}
                                  </td>

                                  <td className="px-4 py-3 text-sm font-medium text-slate-800">
                                    {formatCurrency(
                                      row.employer_amount,
                                    )}
                                  </td>

                                  <td className="px-4 py-3 text-xs text-slate-500">
                                    {formatDateTime(
                                      row.created_at,
                                    )}
                                  </td>
                                </tr>
                              );
                            },
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* RULE SUMMARY */}

                {summary?.rules
                  ?.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-100 px-4 py-3">
                      <h3 className="text-sm font-semibold text-slate-800">
                        Rule Totals
                      </h3>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {summary.rules.map(
                        (rule) => (
                          <div
                            key={
                              rule.rule_id
                            }
                            className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <p className="text-sm font-medium text-slate-800">
                                {
                                  rule.rule_name
                                }
                              </p>

                              <p className="mt-1 font-mono text-xs text-slate-400">
                                {
                                  rule.rule_code
                                }
                              </p>
                            </div>

                            <div className="flex gap-6 text-right">
                              <div>
                                <p className="text-[11px] text-slate-400">
                                  Employee
                                </p>

                                <p className="text-sm font-medium text-slate-700">
                                  {formatCurrency(
                                    rule.employee_amount,
                                  )}
                                </p>
                              </div>

                              <div>
                                <p className="text-[11px] text-slate-400">
                                  Employer
                                </p>

                                <p className="text-sm font-medium text-slate-700">
                                  {formatCurrency(
                                    rule.employer_amount,
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===================================================
          RULE MODAL
      =================================================== */}

      {showRuleForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {editingRule
                    ? "Edit Statutory Rule"
                    : "Create Statutory Rule"}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Configure a reusable statutory payroll rule.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeRuleForm
                }
                disabled={saving}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <RuleForm
                form={form}
                setForm={setForm}
                errors={
                  formErrors
                }
                saving={saving}
                editing={
                  Boolean(
                    editingRule,
                  )
                }
                onSubmit={
                  handleSaveRule
                }
                onCancel={
                  closeRuleForm
                }
                onPreview={() =>
                  setShowPreview(
                    true,
                  )
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* ===================================================
          PREVIEW MODAL
      =================================================== */}

      {showPreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Deduction Preview
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Test the current rule against a sample calculation base.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowPreview(
                    false,
                  )
                }
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Calculation Base
                </label>

                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      previewInput.calculationBase
                    }
                    onChange={(
                      event,
                    ) =>
                      setPreviewInput(
                        {
                          calculationBase:
                            event
                              .target
                              .value,
                        },
                      )
                    }
                    placeholder="Enter amount"
                    className={inputClassName()}
                  />

                  <button
                    type="button"
                    onClick={
                      handlePreview
                    }
                    disabled={
                      previewLoading
                    }
                    className={buttonClassName(
                      previewLoading,
                      "shrink-0 bg-indigo-600 text-white hover:bg-indigo-700",
                    )}
                  >
                    {previewLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Calculator className="h-4 w-4" />
                    )}

                    Calculate
                  </button>
                </div>
              </div>

              {previewResult ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs text-slate-500">
                        Calculation Base
                      </p>

                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {formatCurrency(
                          previewResult.calculation_base,
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs text-slate-500">
                        Employee Amount
                      </p>

                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {formatCurrency(
                          previewResult.employee_amount,
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs text-slate-500">
                        Employer Amount
                      </p>

                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {formatCurrency(
                          previewResult.employer_amount,
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold text-slate-800">
                      Calculation Details
                    </h3>

                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-slate-400">
                          Employee Rate
                        </p>

                        <p className="mt-1 text-sm font-medium text-slate-700">
                          {previewResult.employee_rate ??
                            "—"}
                          {previewResult.employee_rate !==
                            null &&
                          previewResult.employee_rate !==
                            undefined
                            ? "%"
                            : ""}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">
                          Employer Rate
                        </p>

                        <p className="mt-1 text-sm font-medium text-slate-700">
                          {previewResult.employer_rate ??
                            "—"}
                          {previewResult.employer_rate !==
                            null &&
                          previewResult.employer_rate !==
                            undefined
                            ? "%"
                            : ""}
                        </p>
                      </div>
                    </div>
                  </div>

                  {previewResult.warnings
                    ?.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-start gap-3">
                        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />

                        <div>
                          <p className="text-sm font-semibold text-amber-800">
                            Warnings
                          </p>

                          <ul className="mt-2 space-y-1">
                            {previewResult.warnings.map(
                              (
                                warning,
                                index,
                              ) => (
                                <li
                                  key={
                                    index
                                  }
                                  className="text-xs text-amber-700"
                                >
                                  {warning}
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                  <Eye className="mx-auto h-6 w-6 text-slate-300" />

                  <p className="mt-3 text-sm font-medium text-slate-700">
                    Enter a base to preview
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    The preview uses the current unsaved rule configuration.
                  </p>
                </div>
              )}

              <div className="flex justify-end border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() =>
                    setShowPreview(
                      false,
                    )
                  }
                  className={buttonClassName(
                    false,
                    "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  )}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}