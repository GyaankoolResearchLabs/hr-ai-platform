import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  FilePlus2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import api from "../../services/api";

const EMPTY_FORM = {
  policy_code: "",
  title: "",
  category: "",
  description: "",
  status: "draft",
  content: "",
  source_url: "",
  version_status: "draft",
  effective_date: "",
};

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

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

function getStatusClasses(status) {
  switch (
    String(status || "").toLowerCase()
  ) {
    case "published":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "archived":
      return "border-gray-200 bg-gray-100 text-gray-600";

    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

export default function PolicyLibraryTracker() {
  const navigate = useNavigate();

  const [policies, setPolicies] =
    useState([]);

  const [totals, setTotals] =
    useState({
      policies: 0,
      published: 0,
      versions: 0,
      pendingAcknowledgments: 0,
    });

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("");

  const [showCreate, setShowCreate] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [form, setForm] =
    useState(EMPTY_FORM);

  /* =========================================================
     LOAD POLICIES
  ========================================================= */

  async function loadPolicies(
    showRefresh = false,
  ) {
    try {
      setError("");

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response =
        await api.get(
          "/policy-library",
        );

      const data =
        response?.data || {};

      setPolicies(
        Array.isArray(
          data.policies,
        )
          ? data.policies
          : [],
      );

      setTotals({
        policies:
          Number(
            data.totals?.policies ||
              0,
          ),

        published:
          Number(
            data.totals?.published ||
              0,
          ),

        versions:
          Number(
            data.totals?.versions ||
              0,
          ),

        pendingAcknowledgments:
          Number(
            data.totals
              ?.pendingAcknowledgments ||
              0,
          ),
      });
    } catch (err) {
      console.error(
        "[PolicyLibraryTracker] Load error:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          "Failed to load policy library.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadPolicies();
  }, []);

  /* =========================================================
     FILTER
  ========================================================= */

  const filteredPolicies =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return policies.filter(
        (policy) => {
          const matchesSearch =
            !query ||
            String(
              policy.policy_code ||
                "",
            )
              .toLowerCase()
              .includes(query) ||
            String(
              policy.title || "",
            )
              .toLowerCase()
              .includes(query) ||
            String(
              policy.category ||
                "",
            )
              .toLowerCase()
              .includes(query);

          const matchesStatus =
            !statusFilter ||
            policy.status ===
              statusFilter;

          return (
            matchesSearch &&
            matchesStatus
          );
        },
      );
    }, [
      policies,
      search,
      statusFilter,
    ]);

  /* =========================================================
     FORM
  ========================================================= */

  function handleFormChange(
    event,
  ) {
    const {
      name,
      value,
    } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setError("");
    setShowCreate(true);
  }

  function closeCreate() {
    if (saving) {
      return;
    }

    setShowCreate(false);
    setForm(EMPTY_FORM);
  }

  /* =========================================================
     CREATE POLICY
  ========================================================= */

  async function handleCreate(
    event,
  ) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setError("");

    if (!form.policy_code.trim()) {
      setError(
        "Policy code is required.",
      );
      return;
    }

    if (!form.title.trim()) {
      setError(
        "Policy title is required.",
      );
      return;
    }

    if (!form.content.trim()) {
      setError(
        "Policy content is required.",
      );
      return;
    }

    try {
      setSaving(true);

      await api.post(
        "/policy-library",
        {
          policy_code:
            form.policy_code.trim(),

          title:
            form.title.trim(),

          category:
            form.category.trim(),

          description:
            form.description.trim(),

          status:
            form.status,

          content:
            form.content.trim(),

          source_url:
            form.source_url.trim(),

          version_status:
            form.version_status,

          effective_date:
            form.effective_date ||
            null,
        },
      );

      setShowCreate(false);
      setForm(EMPTY_FORM);

      await loadPolicies(true);
    } catch (err) {
      console.error(
        "[PolicyLibraryTracker] Create error:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          "Failed to create policy.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-0">
      {/* =====================================================
          BACK
      ===================================================== */}

      <button
        type="button"
        onClick={() =>
          navigate(-1)
        }
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />

        Back
      </button>

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <BookOpen
              className="h-6 w-6"
              strokeWidth={1.75}
            />
          </span>

          <div>
            <h1 className="text-2xl font-semibold text-gray-950">
              Policy Library &
              Acknowledgment Tracker
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Manage policy versions
              and track employee
              acknowledgments.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              loadPolicies(true)
            }
            disabled={refreshing}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
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

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />

            New Policy
          </button>
        </div>
      </div>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Policies"
          value={totals.policies}
        />

        <SummaryCard
          label="Published"
          value={totals.published}
        />

        <SummaryCard
          label="Versions"
          value={totals.versions}
        />

        <SummaryCard
          label="Pending Acknowledgments"
          value={
            totals.pendingAcknowledgments
          }
        />
      </div>

      {/* =====================================================
          FILTERS
      ===================================================== */}

      <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search policy code, title or category..."
              className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value,
              )
            }
            className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">
              All statuses
            </option>

            <option value="draft">
              Draft
            </option>

            <option value="published">
              Published
            </option>

            <option value="archived">
              Archived
            </option>
          </select>
        </div>
      </div>

      {/* =====================================================
          POLICY LIST
      ===================================================== */}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : filteredPolicies.length ===
          0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <FilePlus2 className="h-10 w-10 text-gray-300" />

            <h3 className="mt-3 text-sm font-semibold text-gray-800">
              No policies found
            </h3>

            <p className="mt-1 max-w-md text-sm text-gray-500">
              Create your first policy
              to start managing versions
              and employee
              acknowledgments.
            </p>

            <button
              type="button"
              onClick={openCreate}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />

              Create Policy
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Policy
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Category
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Version
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Status
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Acknowledgment
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Updated
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredPolicies.map(
                  (policy) => {
                    const currentVersion =
                      policy.current_version;

                    return (
                      <tr
                        key={policy.id}
                        className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                      >
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `/app/tools/policy-library-tracker/${policy.id}`,
                              )
                            }
                            className="text-left"
                          >
                            <p className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
                              {
                                policy.policy_code
                              }
                            </p>

                            <p className="mt-1 text-sm font-medium text-gray-900">
                              {policy.title}
                            </p>
                          </button>
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-600">
                          {policy.category ||
                            "—"}
                        </td>

                        <td className="px-5 py-4">
                          <span className="text-sm font-medium text-gray-700">
                            {currentVersion
                              ? `v${currentVersion.version_number}`
                              : "—"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClasses(
                              policy.status,
                            )}`}
                          >
                            {policy.status ||
                              "draft"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />

                            <span className="text-sm text-gray-700">
                              {
                                policy.acknowledgment_rate
                              }
                              %
                            </span>

                            <span className="text-xs text-gray-400">
                              (
                              {
                                policy.pending_acknowledgments
                              }{" "}
                              pending)
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-500">
                          {formatDate(
                            policy.updated_at,
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

      {/* =====================================================
          CREATE POLICY MODAL
      ===================================================== */}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Create New Policy
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Version 1 will be created
                  automatically.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCreate}
                disabled={saving}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleCreate}
              className="overflow-y-auto"
            >
              <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2">
                <Field
                  label="Policy Code"
                  name="policy_code"
                  value={
                    form.policy_code
                  }
                  onChange={
                    handleFormChange
                  }
                  placeholder="POL-HR-001"
                  required
                />

                <Field
                  label="Policy Title"
                  name="title"
                  value={form.title}
                  onChange={
                    handleFormChange
                  }
                  placeholder="Code of Conduct"
                  required
                />

                <Field
                  label="Category"
                  name="category"
                  value={
                    form.category
                  }
                  onChange={
                    handleFormChange
                  }
                  placeholder="HR Compliance"
                />

                <SelectField
                  label="Policy Status"
                  name="status"
                  value={form.status}
                  onChange={
                    handleFormChange
                  }
                  options={[
                    [
                      "draft",
                      "Draft",
                    ],
                    [
                      "published",
                      "Published",
                    ],
                    [
                      "archived",
                      "Archived",
                    ],
                  ]}
                />

                <div className="md:col-span-2">
                  <Field
                    label="Description"
                    name="description"
                    value={
                      form.description
                    }
                    onChange={
                      handleFormChange
                    }
                    placeholder="Briefly describe this policy..."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Policy Content
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <textarea
                    name="content"
                    value={form.content}
                    onChange={
                      handleFormChange
                    }
                    rows={10}
                    placeholder="Enter the complete policy content..."
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <Field
                  label="Source URL"
                  name="source_url"
                  type="url"
                  value={
                    form.source_url
                  }
                  onChange={
                    handleFormChange
                  }
                  placeholder="https://..."
                />

                <Field
                  label="Effective Date"
                  name="effective_date"
                  type="date"
                  value={
                    form.effective_date
                  }
                  onChange={
                    handleFormChange
                  }
                />

                <SelectField
                  label="Version Status"
                  name="version_status"
                  value={
                    form.version_status
                  }
                  onChange={
                    handleFormChange
                  }
                  options={[
                    [
                      "draft",
                      "Draft",
                    ],
                    [
                      "published",
                      "Published",
                    ],
                    [
                      "archived",
                      "Archived",
                    ],
                  ]}
                />
              </div>

              {error && (
                <div className="mx-6 mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
                <button
                  type="button"
                  onClick={closeCreate}
                  disabled={saving}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}

                  {saving
                    ? "Creating..."
                    : "Create Policy"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  label,
  value,
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold text-gray-950">
        {value}
      </p>
    </div>
  );
}

/* =========================================================
   FIELD
========================================================= */

function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">
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
        className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
    </div>
  );
}

/* =========================================================
   SELECT
========================================================= */

function SelectField({
  label,
  name,
  value,
  onChange,
  options,
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">
        {label}
      </label>

      <select
        name={name}
        value={value}
        onChange={onChange}
        className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      >
        {options.map(
          ([optionValue, optionLabel]) => (
            <option
              key={optionValue}
              value={optionValue}
            >
              {optionLabel}
            </option>
          ),
        )}
      </select>
    </div>
  );
}