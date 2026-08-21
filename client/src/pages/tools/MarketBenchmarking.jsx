import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Edit3,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { api } from "../../lib/api";
import { toast } from "react-hot-toast";

const emptyForm = {
  job_family: "",
  job_title: "",
  level: "",
  location: "",
  currency: "INR",
  market_minimum: "",
  market_median: "",
  market_maximum: "",
  source: "",
  effective_date: "",
  notes: "",
};

function formatMoney(value, currency = "INR") {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "—";
  }

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency || "INR"} ${amount.toLocaleString("en-IN")}`;
  }
}

function calculateMarketStatus(payBand, benchmark) {
  if (!payBand || !benchmark) {
    return {
      key: "none",
      label: "No internal band",
      percentage: null,
      difference: null,
      explanation:
        "Create a matching internal pay band for this job family and level.",
    };
  }

  const internalMidpoint = Number(payBand.midpoint);
  const marketMedian = Number(benchmark.market_median);

  if (
    !Number.isFinite(internalMidpoint) ||
    !Number.isFinite(marketMedian) ||
    marketMedian <= 0
  ) {
    return {
      key: "none",
      label: "Unable to compare",
      percentage: null,
      difference: null,
      explanation:
        "Valid internal midpoint and market median are required.",
    };
  }

  const difference = internalMidpoint - marketMedian;

  const percentage =
    (difference / marketMedian) * 100;

  if (percentage <= -10) {
    return {
      key: "below",
      label: "Below market",
      percentage,
      difference,
      explanation:
        "Internal midpoint is 10% or more below the market median.",
    };
  }

  if (percentage >= 10) {
    return {
      key: "above",
      label: "Above market",
      percentage,
      difference,
      explanation:
        "Internal midpoint is 10% or more above the market median.",
    };
  }

  return {
    key: "near",
    label: "Near market",
    percentage,
    difference,
    explanation:
      "Internal midpoint is within ±10% of the market median.",
  };
}

function getStatusFromComparison(
  comparison,
  benchmark,
) {
  if (!comparison?.pay_band) {
    return calculateMarketStatus(
      null,
      benchmark,
    );
  }

  const calculated = calculateMarketStatus(
    comparison.pay_band,
    benchmark,
  );

  if (
    comparison.midpoint_difference_percent !==
      null &&
    comparison.midpoint_difference_percent !==
      undefined &&
    Number.isFinite(
      Number(
        comparison.midpoint_difference_percent,
      ),
    )
  ) {
    calculated.percentage = Number(
      comparison.midpoint_difference_percent,
    );

    calculated.difference =
      Number(
        comparison.pay_band.midpoint,
      ) -
      Number(benchmark.market_median);
  }

  if (comparison.status === "below_market") {
    calculated.key = "below";
    calculated.label = "Below market";
  }

  if (comparison.status === "near_market") {
    calculated.key = "near";
    calculated.label = "Near market";
  }

  if (comparison.status === "above_market") {
    calculated.key = "above";
    calculated.label = "Above market";
  }

  return calculated;
}

function StatusBadge({ status }) {
  const styles = {
    below:
      "bg-red-50 text-red-700 border-red-100",
    above:
      "bg-emerald-50 text-emerald-700 border-emerald-100",
    near:
      "bg-amber-50 text-amber-700 border-amber-100",
    none:
      "bg-ink-50 text-ink-500 border-ink-100",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
        styles[status.key] || styles.none
      }`}
    >
      {status.key === "below" && (
        <ArrowDown className="mr-1 h-3.5 w-3.5" />
      )}

      {status.key === "above" && (
        <ArrowUp className="mr-1 h-3.5 w-3.5" />
      )}

      {status.key === "near" && (
        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
      )}

      {status.label}
    </span>
  );
}

function Modal({
  open,
  title,
  children,
  onClose,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-ink-100 bg-white px-6 py-4">
          <h2 className="text-lg font-semibold text-ink-950">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-50 hover:text-ink-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  description,
  valueClassName = "text-ink-950",
  labelClassName = "text-ink-400",
}) {
  return (
    <div className="card p-5">
      <p
        className={`text-xs font-medium uppercase tracking-wide ${labelClassName}`}
      >
        {label}
      </p>

      <p
        className={`mt-2 text-2xl font-semibold ${valueClassName}`}
      >
        {value}
      </p>

      <p className="mt-1 text-xs text-ink-500">
        {description}
      </p>
    </div>
  );
}

export default function MarketBenchmarking() {
  const [benchmarks, setBenchmarks] = useState([]);
  const [comparisons, setComparisons] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [comparisonLoading, setComparisonLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState(null);

  const [search, setSearch] =
    useState("");

  const [familyFilter, setFamilyFilter] =
    useState("all");

  const [levelFilter, setLevelFilter] =
    useState("all");

  const [showModal, setShowModal] =
    useState(false);

  const [editingId, setEditingId] =
    useState(null);

  const [form, setForm] =
    useState(emptyForm);

  const [expandedId, setExpandedId] =
    useState(null);

  async function loadBenchmarks() {
    try {
      setLoading(true);

      const response = await api.get(
        "/market-benchmarking",
      );

      setBenchmarks(
        Array.isArray(response.data)
          ? response.data
          : [],
      );
    } catch (error) {
      console.error(
        "Load market benchmarks error:",
        error,
      );

      toast.error(
        error.response?.data?.message ||
          "Could not load market benchmarks",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadComparisons() {
    try {
      setComparisonLoading(true);

      const response = await api.get(
        "/market-benchmarking/compare/pay-bands",
      );

      setComparisons(
        Array.isArray(
          response.data?.comparisons,
        )
          ? response.data.comparisons
          : [],
      );
    } catch (error) {
      console.error(
        "Load market comparisons error:",
        error,
      );

      toast.error(
        error.response?.data?.message ||
          "Could not load market comparison",
      );
    } finally {
      setComparisonLoading(false);
    }
  }

  async function refreshAll() {
    await Promise.all([
      loadBenchmarks(),
      loadComparisons(),
    ]);
  }

  useEffect(() => {
    refreshAll();
  }, []);

  const jobFamilies = useMemo(() => {
    return [
      ...new Set(
        benchmarks
          .map(
            (item) =>
              item.job_family,
          )
          .filter(Boolean),
      ),
    ].sort();
  }, [benchmarks]);

  const levels = useMemo(() => {
    return [
      ...new Set(
        benchmarks
          .map(
            (item) =>
              item.level,
          )
          .filter(Boolean),
      ),
    ].sort();
  }, [benchmarks]);

  const filteredBenchmarks = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return benchmarks.filter((item) => {
      const matchesSearch =
        !query ||
        [
          item.job_family,
          item.job_title,
          item.level,
          item.location,
          item.source,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(query),
          );

      const matchesFamily =
        familyFilter === "all" ||
        item.job_family ===
          familyFilter;

      const matchesLevel =
        levelFilter === "all" ||
        item.level === levelFilter;

      return (
        matchesSearch &&
        matchesFamily &&
        matchesLevel
      );
    });
  }, [
    benchmarks,
    search,
    familyFilter,
    levelFilter,
  ]);

  function getComparisonForBenchmark(
    benchmark,
  ) {
    return comparisons.find(
      (comparison) =>
        comparison.benchmark?.id ===
        benchmark.id,
    );
  }

  function getStatusForBenchmark(
    benchmark,
  ) {
    const comparison =
      getComparisonForBenchmark(
        benchmark,
      );

    return getStatusFromComparison(
      comparison,
      benchmark,
    );
  }

  const summary = useMemo(() => {
    let below = 0;
    let near = 0;
    let above = 0;

    benchmarks.forEach((benchmark) => {
      const status =
        getStatusForBenchmark(
          benchmark,
        );

      if (status.key === "below") {
        below += 1;
      }

      if (status.key === "near") {
        near += 1;
      }

      if (status.key === "above") {
        above += 1;
      }
    });

    return {
      total: benchmarks.length,
      families: jobFamilies.length,
      below,
      near,
      above,
    };
  }, [
    benchmarks,
    comparisons,
    jobFamilies,
  ]);

  function handleChange(event) {
    const {
      name,
      value,
    } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function openCreateModal() {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEditModal(item) {
    setEditingId(item.id);

    setForm({
      job_family:
        item.job_family || "",
      job_title:
        item.job_title || "",
      level:
        item.level || "",
      location:
        item.location || "",
      currency:
        item.currency || "INR",
      market_minimum:
        item.market_minimum ?? "",
      market_median:
        item.market_median ?? "",
      market_maximum:
        item.market_maximum ?? "",
      source:
        item.source || "",
      effective_date:
        item.effective_date || "",
      notes:
        item.notes || "",
    });

    setShowModal(true);
  }

  function closeModal() {
    if (saving) {
      return;
    }

    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const minimum = Number(
      form.market_minimum,
    );

    const median = Number(
      form.market_median,
    );

    const maximum = Number(
      form.market_maximum,
    );

    if (!form.job_family.trim()) {
      toast.error(
        "Job family is required",
      );
      return;
    }

    if (!form.job_title.trim()) {
      toast.error(
        "Job title is required",
      );
      return;
    }

    if (!form.level.trim()) {
      toast.error(
        "Level is required",
      );
      return;
    }

    if (
      !Number.isFinite(minimum) ||
      !Number.isFinite(median) ||
      !Number.isFinite(maximum)
    ) {
      toast.error(
        "Enter valid market salary values",
      );
      return;
    }

    if (
      minimum < 0 ||
      median < minimum ||
      maximum < median
    ) {
      toast.error(
        "Salary range must satisfy Minimum ≤ Median ≤ Maximum",
      );
      return;
    }

    const payload = {
      ...form,
      job_family:
        form.job_family.trim(),
      job_title:
        form.job_title.trim(),
      level:
        form.level.trim(),
      location:
        form.location.trim(),
      currency:
        form.currency.trim() ||
        "INR",
      market_minimum: minimum,
      market_median: median,
      market_maximum: maximum,
      source:
        form.source.trim(),
      notes:
        form.notes.trim(),
    };

    try {
      setSaving(true);

      if (editingId) {
        await api.put(
          `/market-benchmarking/${editingId}`,
          payload,
        );

        toast.success(
          "Market benchmark updated",
        );
      } else {
        await api.post(
          "/market-benchmarking",
          payload,
        );

        toast.success(
          "Market benchmark created",
        );
      }

      closeModal();

      await refreshAll();
    } catch (error) {
      console.error(
        "Save market benchmark error:",
        error,
      );

      toast.error(
        error.response?.data?.message ||
          "Could not save market benchmark",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item) {
    const confirmed =
      window.confirm(
        `Delete the market benchmark for ${item.job_title} (${item.level})?`,
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(item.id);

      await api.delete(
        `/market-benchmarking/${item.id}`,
      );

      toast.success(
        "Market benchmark deleted",
      );

      if (
        expandedId === item.id
      ) {
        setExpandedId(null);
      }

      await refreshAll();
    } catch (error) {
      console.error(
        "Delete market benchmark error:",
        error,
      );

      toast.error(
        error.response?.data?.message ||
          "Could not delete market benchmark",
      );
    } finally {
      setDeletingId(null);
    }
  }

  function renderComparisonDetails(
    benchmark,
    comparison,
    status,
  ) {
    if (!comparison?.pay_band) {
      return (
        <div className="mt-2">
          <p className="text-xs font-medium text-ink-600">
            No matching internal pay band
          </p>

          <p className="mt-0.5 text-xs text-ink-500">
            Match the job family and level
            with an internal pay band to
            calculate the market position.
          </p>
        </div>
      );
    }

    const midpoint =
      Number(
        comparison.pay_band
          .midpoint,
      );

    const median =
      Number(
        benchmark.market_median,
      );

    const difference =
      midpoint - median;

    const percentage =
      median > 0
        ? (difference / median) *
          100
        : null;

    return (
      <div className="mt-2 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xs text-ink-500">
            Internal midpoint:
          </span>

          <span className="text-xs font-semibold text-ink-800">
            {formatMoney(
              midpoint,
              comparison
                .pay_band
                .currency,
            )}
          </span>

          {percentage !== null && (
            <span
              className={`text-xs font-semibold ${
                status.key === "below"
                  ? "text-red-600"
                  : status.key ===
                      "above"
                    ? "text-emerald-600"
                    : "text-amber-600"
              }`}
            >
              {percentage > 0
                ? "+"
                : ""}
              {percentage.toFixed(
                1,
              )}
              % vs median
            </span>
          )}
        </div>

        <p className="text-xs text-ink-500">
          {status.explanation}
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => window.history.back()}
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink-500 transition hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <BarChart3
                className="h-5 w-5"
                strokeWidth={1.75}
              />
            </span>

            <div>
              <h1 className="font-display text-2xl font-semibold text-ink-950">
                Market Benchmarking
              </h1>

              <p className="mt-1 text-sm text-ink-500">
                Compare your compensation
                structure against market
                benchmarks.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refreshAll}
            disabled={
              loading ||
              comparisonLoading
            }
            className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                loading ||
                comparisonLoading
                  ? "animate-spin"
                  : ""
              }`}
            />

            Refresh
          </button>

          <button
            type="button"
            onClick={
              openCreateModal
            }
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />

            Add benchmark
          </button>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          label="Benchmarks"
          value={summary.total}
          description="Market records"
        />

        <SummaryCard
          label="Job families"
          value={summary.families}
          description="Represented in benchmarks"
        />

        <SummaryCard
          label="Below market"
          value={summary.below}
          description="Internal midpoint is 10%+ below median"
          valueClassName="text-red-700"
          labelClassName="text-red-600"
        />

        <SummaryCard
          label="Near market"
          value={summary.near}
          description="Internal midpoint is within ±10% of median"
          valueClassName="text-amber-700"
          labelClassName="text-amber-600"
        />

        <SummaryCard
          label="Above market"
          value={summary.above}
          description="Internal midpoint is 10%+ above median"
          valueClassName="text-emerald-700"
          labelClassName="text-emerald-600"
        />
      </div>

      <div className="card mb-6 p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search job family, title, level, location..."
              className="w-full rounded-lg border border-ink-200 bg-white py-2.5 pl-9 pr-3 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div className="relative">
            <select
              value={familyFilter}
              onChange={(event) =>
                setFamilyFilter(
                  event.target.value,
                )
              }
              className="w-full appearance-none rounded-lg border border-ink-200 bg-white px-3 py-2.5 pr-9 text-sm text-ink-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              <option value="all">
                All job families
              </option>

              {jobFamilies.map(
                (family) => (
                  <option
                    key={family}
                    value={family}
                  >
                    {family}
                  </option>
                ),
              )}
            </select>

            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          </div>

          <div className="relative">
            <select
              value={levelFilter}
              onChange={(event) =>
                setLevelFilter(
                  event.target.value,
                )
              }
              className="w-full appearance-none rounded-lg border border-ink-200 bg-white px-3 py-2.5 pr-9 text-sm text-ink-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              <option value="all">
                All levels
              </option>

              {levels.map(
                (level) => (
                  <option
                    key={level}
                    value={level}
                  >
                    {level}
                  </option>
                ),
              )}
            </select>

            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">
              Market benchmarks
            </h2>

            <p className="mt-0.5 text-xs text-ink-500">
              {filteredBenchmarks.length}{" "}
              of {benchmarks.length}{" "}
              records shown
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-72 items-center justify-center">
            <RefreshCw className="h-5 w-5 animate-spin text-brand-600" />
          </div>
        ) : filteredBenchmarks.length ===
          0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-50 text-ink-400">
              <BarChart3 className="h-6 w-6" />
            </div>

            <h3 className="mt-4 text-sm font-semibold text-ink-900">
              {benchmarks.length ===
              0
                ? "No market benchmarks yet"
                : "No matching benchmarks"}
            </h3>

            <p className="mt-1 max-w-md text-sm text-ink-500">
              {benchmarks.length ===
              0
                ? "Add your first market benchmark to start comparing compensation against external market data."
                : "Try changing your search or filters."}
            </p>

            {benchmarks.length ===
              0 && (
              <button
                type="button"
                onClick={
                  openCreateModal
                }
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                <Plus className="h-4 w-4" />
                Add benchmark
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1150px] w-full">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60 text-left">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
                    Role
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
                    Level
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
                    Location
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
                    Market range
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
                    Internal position
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
                    Difference
                  </th>

                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-400">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredBenchmarks.map(
                  (benchmark) => {
                    const comparison =
                      getComparisonForBenchmark(
                        benchmark,
                      );

                    const status =
                      getStatusForBenchmark(
                        benchmark,
                      );

                    const expanded =
                      expandedId ===
                      benchmark.id;

                    const midpoint =
                      comparison?.pay_band
                        ? Number(
                            comparison
                              .pay_band
                              .midpoint,
                          )
                        : null;

                    const median =
                      Number(
                        benchmark.market_median,
                      );

                    const percentage =
                      midpoint !==
                        null &&
                      Number.isFinite(
                        midpoint,
                      ) &&
                      median > 0
                        ? ((midpoint -
                            median) /
                            median) *
                          100
                        : null;

                    return (
                      <tr
                        key={
                          benchmark.id
                        }
                        className="border-b border-ink-100"
                      >
                        <td
                          colSpan={7}
                          className="p-0"
                        >
                          <div className="transition hover:bg-ink-50/40">
                            <div className="grid grid-cols-[minmax(220px,1.4fr)_100px_130px_180px_minmax(210px,1.4fr)_130px_120px] items-center">
                              <div className="px-5 py-4">
                                <div className="font-medium text-ink-900">
                                  {
                                    benchmark.job_title
                                  }
                                </div>

                                <div className="mt-0.5 text-xs text-ink-500">
                                  {
                                    benchmark.job_family
                                  }
                                </div>
                              </div>

                              <div className="px-5 py-4 text-sm text-ink-700">
                                {
                                  benchmark.level
                                }
                              </div>

                              <div className="px-5 py-4 text-sm text-ink-700">
                                {benchmark.location ||
                                  "—"}
                              </div>

                              <div className="px-5 py-4">
                                <div className="text-sm font-medium text-ink-900">
                                  {formatMoney(
                                    benchmark.market_median,
                                    benchmark.currency,
                                  )}
                                </div>

                                <div className="mt-1 text-xs text-ink-500">
                                  {formatMoney(
                                    benchmark.market_minimum,
                                    benchmark.currency,
                                  )}{" "}
                                  –{" "}
                                  {formatMoney(
                                    benchmark.market_maximum,
                                    benchmark.currency,
                                  )}
                                </div>
                              </div>

                              <div className="px-5 py-4">
                                <StatusBadge
                                  status={
                                    status
                                  }
                                />

                                {renderComparisonDetails(
                                  benchmark,
                                  comparison,
                                  status,
                                )}
                              </div>

                              <div className="px-5 py-4">
                                {percentage !==
                                null ? (
                                  <div
                                    className={`text-sm font-semibold ${
                                      status.key ===
                                      "below"
                                        ? "text-red-600"
                                        : status.key ===
                                            "above"
                                          ? "text-emerald-600"
                                          : "text-amber-600"
                                    }`}
                                  >
                                    {percentage >
                                    0
                                      ? "+"
                                      : ""}
                                    {percentage.toFixed(
                                      1,
                                    )}
                                    %
                                  </div>
                                ) : (
                                  <span className="text-sm text-ink-400">
                                    —
                                  </span>
                                )}

                                <div className="mt-0.5 text-xs text-ink-400">
                                  vs market
                                  median
                                </div>
                              </div>

                              <div className="px-5 py-4">
                                <div className="flex justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedId(
                                        expanded
                                          ? null
                                          : benchmark.id,
                                      )
                                    }
                                    className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
                                    title="View details"
                                  >
                                    <ChevronDown
                                      className={`h-4 w-4 transition-transform ${
                                        expanded
                                          ? "rotate-180"
                                          : ""
                                      }`}
                                    />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      openEditModal(
                                        benchmark,
                                      )
                                    }
                                    className="rounded-lg p-2 text-ink-400 transition hover:bg-brand-50 hover:text-brand-700"
                                    title="Edit benchmark"
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDelete(
                                        benchmark,
                                      )
                                    }
                                    disabled={
                                      deletingId ===
                                      benchmark.id
                                    }
                                    className="rounded-lg p-2 text-ink-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                                    title="Delete benchmark"
                                  >
                                    {deletingId ===
                                    benchmark.id ? (
                                      <RefreshCw className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>

                            {expanded && (
                              <div className="border-t border-ink-100 bg-ink-50/30 px-5 py-5">
                                <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                                      Market minimum
                                    </p>

                                    <p className="mt-1 text-sm font-semibold text-ink-900">
                                      {formatMoney(
                                        benchmark.market_minimum,
                                        benchmark.currency,
                                      )}
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                                      Market median
                                    </p>

                                    <p className="mt-1 text-sm font-semibold text-ink-900">
                                      {formatMoney(
                                        benchmark.market_median,
                                        benchmark.currency,
                                      )}
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                                      Market maximum
                                    </p>

                                    <p className="mt-1 text-sm font-semibold text-ink-900">
                                      {formatMoney(
                                        benchmark.market_maximum,
                                        benchmark.currency,
                                      )}
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                                      Internal midpoint
                                    </p>

                                    <p className="mt-1 text-sm font-semibold text-ink-900">
                                      {comparison?.pay_band
                                        ? formatMoney(
                                            comparison
                                              .pay_band
                                              .midpoint,
                                            comparison
                                              .pay_band
                                              .currency,
                                          )
                                        : "No matching pay band"}
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                                      Market position
                                    </p>

                                    <div className="mt-1">
                                      <StatusBadge
                                        status={
                                          status
                                        }
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                                      Difference from median
                                    </p>

                                    <p className="mt-1 text-sm font-semibold text-ink-900">
                                      {percentage !==
                                      null
                                        ? `${
                                            percentage >
                                            0
                                              ? "+"
                                              : ""
                                          }${percentage.toFixed(
                                            1,
                                          )}%`
                                        : "—"}
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                                      Source
                                    </p>

                                    <p className="mt-1 text-sm text-ink-700">
                                      {benchmark.source ||
                                        "Not provided"}
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                                      Effective date
                                    </p>

                                    <p className="mt-1 text-sm text-ink-700">
                                      {benchmark.effective_date
                                        ? new Date(
                                            `${benchmark.effective_date}T00:00:00`,
                                          ).toLocaleDateString(
                                            "en-IN",
                                            {
                                              day: "2-digit",
                                              month:
                                                "short",
                                              year: "numeric",
                                            },
                                          )
                                        : "Not provided"}
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                                      Comparison rule
                                    </p>

                                    <p className="mt-1 text-sm text-ink-700">
                                      Below: ≤
                                      -10%
                                      <br />
                                      Near: -10%
                                      to +10%
                                      <br />
                                      Above: ≥
                                      +10%
                                    </p>
                                  </div>

                                  {benchmark.notes && (
                                    <div className="md:col-span-3">
                                      <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                                        Notes
                                      </p>

                                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
                                        {
                                          benchmark.notes
                                        }
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
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

      <Modal
        open={showModal}
        title={
          editingId
            ? "Edit market benchmark"
            : "Add market benchmark"
        }
        onClose={closeModal}
      >
        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          <div>
            <h3 className="text-sm font-semibold text-ink-900">
              Role information
            </h3>

            <p className="mt-1 text-xs text-ink-500">
              Define the role and level this
              market benchmark represents.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-700">
                Job family
              </label>

              <input
                name="job_family"
                value={
                  form.job_family
                }
                onChange={
                  handleChange
                }
                placeholder="Engineering"
                className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-700">
                Job title
              </label>

              <input
                name="job_title"
                value={
                  form.job_title
                }
                onChange={
                  handleChange
                }
                placeholder="Software Engineer"
                className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-700">
                Level
              </label>

              <input
                name="level"
                value={form.level}
                onChange={
                  handleChange
                }
                placeholder="L2"
                className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-700">
                Location
              </label>

              <input
                name="location"
                value={
                  form.location
                }
                onChange={
                  handleChange
                }
                placeholder="Bengaluru"
                className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-ink-900">
              Market compensation
            </h3>

            <p className="mt-1 text-xs text-ink-500">
              Enter the externally sourced
              market compensation range.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-700">
                Currency
              </label>

              <select
                name="currency"
                value={
                  form.currency
                }
                onChange={
                  handleChange
                }
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              >
                <option value="INR">
                  INR
                </option>

                <option value="USD">
                  USD
                </option>

                <option value="EUR">
                  EUR
                </option>

                <option value="GBP">
                  GBP
                </option>

                <option value="AED">
                  AED
                </option>

                <option value="SGD">
                  SGD
                </option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-700">
                Market minimum
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                name="market_minimum"
                value={
                  form.market_minimum
                }
                onChange={
                  handleChange
                }
                placeholder="500000"
                className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-700">
                Market median
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                name="market_median"
                value={
                  form.market_median
                }
                onChange={
                  handleChange
                }
                placeholder="700000"
                className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-700">
                Market maximum
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                name="market_maximum"
                value={
                  form.market_maximum
                }
                onChange={
                  handleChange
                }
                placeholder="950000"
                className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4">
            <p className="text-sm font-semibold text-ink-900">
              How market position is calculated
            </p>

            <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-ink-600 sm:grid-cols-3">
              <div>
                <span className="font-semibold text-red-600">
                  Below market
                </span>
                <br />
                Internal midpoint is 10%+
                below market median.
              </div>

              <div>
                <span className="font-semibold text-amber-600">
                  Near market
                </span>
                <br />
                Internal midpoint is within
                ±10% of market median.
              </div>

              <div>
                <span className="font-semibold text-emerald-600">
                  Above market
                </span>
                <br />
                Internal midpoint is 10%+
                above market median.
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-ink-900">
              Benchmark source
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-700">
                Source
              </label>

              <input
                name="source"
                value={form.source}
                onChange={
                  handleChange
                }
                placeholder="Mercer, Radford, Salary survey..."
                className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-700">
                Effective date
              </label>

              <input
                type="date"
                name="effective_date"
                value={
                  form.effective_date
                }
                onChange={
                  handleChange
                }
                className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-700">
              Notes
            </label>

            <textarea
              name="notes"
              value={form.notes}
              onChange={
                handleChange
              }
              rows={4}
              placeholder="Add context about the benchmark, source methodology or assumptions..."
              className="w-full resize-y rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-ink-100 pt-5">
            <button
              type="button"
              onClick={closeModal}
              disabled={saving}
              className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && (
                <RefreshCw className="h-4 w-4 animate-spin" />
              )}

              {editingId
                ? "Save changes"
                : "Create benchmark"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}