import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Wallet,
  RefreshCw,
  Sparkles,
  Check,
  X,
  Users,
  TrendingUp,
  WandSparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../../lib/api";

const EMPTY_FORM = {
  job_family: "",
  level: "",
  currency: "INR",
  minimum: "",
  midpoint: "",
  maximum: "",
  notes: "",
  status: "active",
};

function formatMoney(value, currency) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(
    Number(value || 0),
  );
}

export default function PayBandStructureBuilder() {
  const navigate = useNavigate();

  const [bands, setBands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState(
    EMPTY_FORM,
  );

  const [generating, setGenerating] =
    useState(false);

  const [
    generatedRecommendations,
    setGeneratedRecommendations,
  ] = useState([]);

  const [
    generationStats,
    setGenerationStats,
  ] = useState(null);

  const [
    selectedRecommendations,
    setSelectedRecommendations,
  ] = useState([]);

  const [
    showRecommendations,
    setShowRecommendations,
  ] = useState(false);

  const [
    approvingRecommendations,
    setApprovingRecommendations,
  ] = useState(false);

  /* =========================================================
     LOAD PAY BANDS
  ========================================================= */

  const loadBands = async () => {
    try {
      setLoading(true);

      const response = await api.get(
        "/pay-bands",
      );

      setBands(response.data || []);
    } catch (error) {
      console.error(error);

      toast.error(
        error.response?.data?.message ||
          "Could not load pay bands",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBands();
  }, []);

  /* =========================================================
     STATISTICS
  ========================================================= */

  const stats = useMemo(() => {
    const active = bands.filter(
      (band) =>
        band.status === "active",
    ).length;

    const families = new Set(
      bands.map(
        (band) => band.job_family,
      ),
    ).size;

    return {
      total: bands.length,
      active,
      families,
    };
  }, [bands]);

  /* =========================================================
     FORM
  ========================================================= */

  const handleChange = (event) => {
    const { name, value } =
      event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  };

  /* =========================================================
     MANUAL CREATE / UPDATE
  ========================================================= */

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (
      !form.job_family.trim() ||
      !form.level.trim()
    ) {
      toast.error(
        "Job family and level are required",
      );
      return;
    }

    const minimum = Number(
      form.minimum,
    );

    const midpoint = Number(
      form.midpoint,
    );

    const maximum = Number(
      form.maximum,
    );

    if (
      !Number.isFinite(minimum) ||
      !Number.isFinite(midpoint) ||
      !Number.isFinite(maximum)
    ) {
      toast.error(
        "Enter valid salary values",
      );
      return;
    }

    if (
      minimum < 0 ||
      midpoint < minimum ||
      maximum < midpoint
    ) {
      toast.error(
        "Use Minimum ≤ Midpoint ≤ Maximum",
      );
      return;
    }

    try {
      setSaving(true);

      const payload = {
        ...form,
        minimum,
        midpoint,
        maximum,
      };

      if (editingId) {
        const response =
          await api.put(
            `/pay-bands/${editingId}`,
            payload,
          );

        setBands((current) =>
          current.map((band) =>
            band.id === editingId
              ? response.data
              : band,
          ),
        );

        toast.success(
          "Pay band updated",
        );
      } else {
        const response =
          await api.post(
            "/pay-bands",
            payload,
          );

        setBands((current) => [
          response.data,
          ...current,
        ]);

        toast.success(
          "Pay band created",
        );
      }

      resetForm();
    } catch (error) {
      console.error(error);

      toast.error(
        error.response?.data?.message ||
          "Could not save pay band",
      );
    } finally {
      setSaving(false);
    }
  };

  /* =========================================================
     EDIT
  ========================================================= */

  const handleEdit = (band) => {
    setEditingId(band.id);

    setForm({
      job_family:
        band.job_family || "",

      level:
        band.level || "",

      currency:
        band.currency || "INR",

      minimum:
        String(
          band.minimum ?? "",
        ),

      midpoint:
        String(
          band.midpoint ?? "",
        ),

      maximum:
        String(
          band.maximum ?? "",
        ),

      notes:
        band.notes || "",

      status:
        band.status || "active",
    });

    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  /* =========================================================
     DELETE
  ========================================================= */

  const handleDelete = async (id) => {
    const confirmed =
      window.confirm(
        "Delete this pay band?",
      );

    if (!confirmed) return;

    try {
      await api.delete(
        `/pay-bands/${id}`,
      );

      setBands((current) =>
        current.filter(
          (band) =>
            band.id !== id,
        ),
      );

      toast.success(
        "Pay band deleted",
      );
    } catch (error) {
      console.error(error);

      toast.error(
        error.response?.data?.message ||
          "Could not delete pay band",
      );
    }
  };

  /* =========================================================
     GENERATE PAY STRUCTURE
  ========================================================= */

  const handleGenerate = async () => {
    try {
      setGenerating(true);

      setGeneratedRecommendations(
        [],
      );

      setSelectedRecommendations(
        [],
      );

      setGenerationStats(null);

      const response =
        await api.post(
          "/pay-bands/generate",
        );

      const recommendations =
        response.data
          ?.recommendations || [];

      setGeneratedRecommendations(
        recommendations,
      );

      setGenerationStats({
        employeesAnalyzed:
          response.data
            ?.employees_analyzed || 0,

        employeeGroups:
          response.data
            ?.employee_groups || 0,

        recommendations:
          recommendations.length,
      });

      setSelectedRecommendations(
        recommendations.map(
          (_, index) => index,
        ),
      );

      setShowRecommendations(true);

      if (!recommendations.length) {
        toast.error(
          "No pay structure recommendations were generated.",
        );
      } else {
        toast.success(
          "Pay structure generated from workforce data",
        );
      }
    } catch (error) {
      console.error(
        "Generate pay structure error:",
        error,
      );

      toast.error(
        error.response?.data?.message ||
          "Could not generate pay structure",
      );
    } finally {
      setGenerating(false);
    }
  };

  /* =========================================================
     SELECT / DESELECT RECOMMENDATION
  ========================================================= */

  const toggleRecommendation = (
    index,
  ) => {
    setSelectedRecommendations(
      (current) => {
        if (
          current.includes(index)
        ) {
          return current.filter(
            (item) =>
              item !== index,
          );
        }

        return [
          ...current,
          index,
        ];
      },
    );
  };

  const selectAllRecommendations =
    () => {
      setSelectedRecommendations(
        generatedRecommendations.map(
          (_, index) => index,
        ),
      );
    };

  const clearAllRecommendations =
    () => {
      setSelectedRecommendations(
        [],
      );
    };

  /* =========================================================
     EDIT GENERATED RECOMMENDATION
  ========================================================= */

  const updateRecommendation = (
    index,
    field,
    value,
  ) => {
    setGeneratedRecommendations(
      (current) =>
        current.map(
          (recommendation, itemIndex) =>
            itemIndex === index
              ? {
                  ...recommendation,
                  [field]:
                    field ===
                      "minimum" ||
                    field ===
                      "midpoint" ||
                    field ===
                      "maximum"
                      ? Number(
                          value,
                        )
                      : value,
                }
              : recommendation,
        ),
    );
  };

  /* =========================================================
     APPROVE GENERATED PAY STRUCTURE
  ========================================================= */

  const handleApproveGenerated =
    async () => {
      if (
        !selectedRecommendations.length
      ) {
        toast.error(
          "Select at least one recommendation",
        );
        return;
      }

      const selectedBands =
        selectedRecommendations
          .map(
            (index) =>
              generatedRecommendations[
                index
              ],
          )
          .filter(Boolean);

      for (const band of selectedBands) {
        if (
          !band.job_family?.trim() ||
          !band.level?.trim()
        ) {
          toast.error(
            "Every selected band needs a job family and level",
          );
          return;
        }

        const minimum =
          Number(
            band.minimum,
          );

        const midpoint =
          Number(
            band.midpoint,
          );

        const maximum =
          Number(
            band.maximum,
          );

        if (
          !Number.isFinite(
            minimum,
          ) ||
          !Number.isFinite(
            midpoint,
          ) ||
          !Number.isFinite(
            maximum,
          ) ||
          minimum < 0 ||
          midpoint < minimum ||
          maximum < midpoint
        ) {
          toast.error(
            `Invalid salary range for ${band.job_family} - ${band.level}`,
          );
          return;
        }
      }

      try {
        setApprovingRecommendations(
          true,
        );

        const response =
          await api.post(
            "/pay-bands/generate/approve",
            {
              bands:
                selectedBands,
            },
          );

        const savedBands =
          response.data
            ?.bands || [];

        if (savedBands.length) {
          setBands(
            (current) => {
              const next = [
                ...current,
              ];

              for (const saved of savedBands) {
                const existingIndex =
                  next.findIndex(
                    (band) =>
                      String(
                        band.job_family,
                      ).toLowerCase() ===
                        String(
                          saved.job_family,
                        ).toLowerCase() &&
                      String(
                        band.level,
                      ).toLowerCase() ===
                        String(
                          saved.level,
                        ).toLowerCase(),
                  );

                if (
                  existingIndex >=
                  0
                ) {
                  next[
                    existingIndex
                  ] = saved;
                } else {
                  next.unshift(
                    saved,
                  );
                }
              }

              return next;
            },
          );
        } else {
          await loadBands();
        }

        toast.success(
          `${savedBands.length || selectedBands.length} pay band(s) approved and saved`,
        );

        setShowRecommendations(
          false,
        );

        setGeneratedRecommendations(
          [],
        );

        setSelectedRecommendations(
          [],
        );

        setGenerationStats(
          null,
        );
      } catch (error) {
        console.error(
          "Approve generated pay structure error:",
          error,
        );

        toast.error(
          error.response?.data?.message ||
            "Could not approve generated pay structure",
        );
      } finally {
        setApprovingRecommendations(
          false,
        );
      }
    };

  /* =========================================================
     CLOSE RECOMMENDATIONS
  ========================================================= */

  const closeRecommendations =
    () => {
      setShowRecommendations(
        false,
      );

      setGeneratedRecommendations(
        [],
      );

      setSelectedRecommendations(
        [],
      );

      setGenerationStats(
        null,
      );
    };

  /* =========================================================
     RENDER
  ========================================================= */

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
        className="mb-6 inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Wallet
              className="h-6 w-6"
              strokeWidth={1.75}
            />
          </span>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
              Pay Structuring
            </p>

            <h1 className="mt-1 font-display text-2xl font-semibold text-ink-950">
              Pay Band & Structure Builder
            </h1>

            <p className="mt-1 max-w-2xl text-sm text-ink-500">
              Create consistent salary
              structures manually or
              generate recommended
              pay bands automatically
              from your organization's
              workforce data.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}

            {generating
              ? "Analyzing..."
              : "Generate structure"}
          </button>

          <button
            type="button"
            onClick={loadBands}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                loading
                  ? "animate-spin"
                  : ""
              }`}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm(
                EMPTY_FORM,
              );
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
          >
            <Plus className="h-4 w-4" />
            Add pay band
          </button>
        </div>
      </div>

      {/* =====================================================
          AUTOMATION EXPLAINER
      ===================================================== */}

      <div className="mb-6 rounded-xl border border-brand-100 bg-brand-50/60 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand-700 shadow-sm">
              <WandSparkles className="h-5 w-5" />
            </span>

            <div>
              <h2 className="text-sm font-semibold text-ink-900">
                Automated pay structure
              </h2>

              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-600">
                Analyze current workforce
                compensation, group employees
                by job family and level, and
                generate salary ranges for
                HR review before anything is
                saved.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-brand-700 shadow-sm ring-1 ring-brand-200 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            {generating
              ? "Generating..."
              : "Analyze workforce"}
          </button>
        </div>
      </div>

      {/* =====================================================
          STATS
      ===================================================== */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-ink-400">
            Total bands
          </p>

          <p className="mt-2 text-2xl font-semibold text-ink-950">
            {stats.total}
          </p>
        </div>

        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-ink-400">
            Active bands
          </p>

          <p className="mt-2 text-2xl font-semibold text-ink-950">
            {stats.active}
          </p>
        </div>

        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-ink-400">
            Job families
          </p>

          <p className="mt-2 text-2xl font-semibold text-ink-950">
            {stats.families}
          </p>
        </div>
      </div>

      {/* =====================================================
          GENERATED RECOMMENDATIONS
      ===================================================== */}

      {showRecommendations && (
        <div className="card mb-6 overflow-hidden border-brand-100">
          <div className="border-b border-ink-100 bg-brand-50/50 px-5 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-brand-700" />

                  <h2 className="text-base font-semibold text-ink-900">
                    AI-generated pay structure
                  </h2>
                </div>

                <p className="mt-1 max-w-3xl text-sm text-ink-600">
                  Review the recommendations
                  below. Nothing is saved until
                  you approve the selected
                  structures.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeRecommendations
                }
                className="inline-flex items-center justify-center rounded-lg p-2 text-ink-400 hover:bg-white hover:text-ink-800"
                title="Close recommendations"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {generationStats && (
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-white p-4 ring-1 ring-brand-100">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-400">
                    <Users className="h-4 w-4" />
                    Employees analyzed
                  </div>

                  <p className="mt-2 text-xl font-semibold text-ink-950">
                    {formatNumber(
                      generationStats.employeesAnalyzed,
                    )}
                  </p>
                </div>

                <div className="rounded-lg bg-white p-4 ring-1 ring-brand-100">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-400">
                    <Wallet className="h-4 w-4" />
                    Workforce groups
                  </div>

                  <p className="mt-2 text-xl font-semibold text-ink-950">
                    {formatNumber(
                      generationStats.employeeGroups,
                    )}
                  </p>
                </div>

                <div className="rounded-lg bg-white p-4 ring-1 ring-brand-100">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-400">
                    <TrendingUp className="h-4 w-4" />
                    Recommendations
                  </div>

                  <p className="mt-2 text-xl font-semibold text-ink-950">
                    {formatNumber(
                      generationStats.recommendations,
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>

          {generatedRecommendations.length ===
          0 ? (
            <div className="p-8 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-ink-300" />

              <p className="mt-3 text-sm text-ink-500">
                No recommendations
                available.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 border-b border-ink-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-ink-800">
                    {selectedRecommendations.length}{" "}
                    of{" "}
                    {
                      generatedRecommendations.length
                    }{" "}
                    selected
                  </p>

                  <p className="mt-0.5 text-xs text-ink-400">
                    Select the bands you want
                    to save.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={
                      selectAllRecommendations
                    }
                    className="rounded-lg border border-ink-200 px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50"
                  >
                    Select all
                  </button>

                  <button
                    type="button"
                    onClick={
                      clearAllRecommendations
                    }
                    className="rounded-lg border border-ink-200 px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="divide-y divide-ink-100">
                {generatedRecommendations.map(
                  (
                    recommendation,
                    index,
                  ) => {
                    const selected =
                      selectedRecommendations.includes(
                        index,
                      );

                    return (
                      <div
                        key={`${recommendation.job_family}-${recommendation.level}-${index}`}
                        className={`p-5 transition ${
                          selected
                            ? "bg-white"
                            : "bg-ink-50/40"
                        }`}
                      >
                        <div className="flex flex-col gap-5">
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                toggleRecommendation(
                                  index,
                                )
                              }
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                                selected
                                  ? "border-brand-600 bg-brand-600 text-white"
                                  : "border-ink-300 bg-white"
                              }`}
                            >
                              {selected && (
                                <Check className="h-3.5 w-3.5" />
                              )}
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <h3 className="text-sm font-semibold text-ink-900">
                                    {
                                      recommendation.job_family
                                    }{" "}
                                    ·{" "}
                                    {
                                      recommendation.level
                                    }
                                  </h3>

                                  <p className="mt-0.5 text-xs text-ink-400">
                                    {
                                      recommendation.employee_count
                                    }{" "}
                                    employees analyzed
                                  </p>
                                </div>

                                {recommendation.is_existing ? (
                                  <span className="inline-flex w-fit rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                                    Existing band
                                  </span>
                                ) : (
                                  <span className="inline-flex w-fit rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                                    New recommendation
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <label className="block">
                              <span className="text-xs font-medium uppercase tracking-wide text-ink-400">
                                Minimum
                              </span>

                              <input
                                type="number"
                                value={
                                  recommendation.minimum ??
                                  ""
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateRecommendation(
                                    index,
                                    "minimum",
                                    event
                                      .target
                                      .value,
                                  )
                                }
                                min="0"
                                className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                              />

                              <span className="mt-1 block text-xs text-ink-400">
                                {formatMoney(
                                  recommendation.minimum,
                                  recommendation.currency,
                                )}
                              </span>
                            </label>

                            <label className="block">
                              <span className="text-xs font-medium uppercase tracking-wide text-ink-400">
                                Midpoint
                              </span>

                              <input
                                type="number"
                                value={
                                  recommendation.midpoint ??
                                  ""
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateRecommendation(
                                    index,
                                    "midpoint",
                                    event
                                      .target
                                      .value,
                                  )
                                }
                                min="0"
                                className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm font-medium outline-none focus:border-brand-500"
                              />

                              <span className="mt-1 block text-xs text-ink-400">
                                {formatMoney(
                                  recommendation.midpoint,
                                  recommendation.currency,
                                )}
                              </span>
                            </label>

                            <label className="block">
                              <span className="text-xs font-medium uppercase tracking-wide text-ink-400">
                                Maximum
                              </span>

                              <input
                                type="number"
                                value={
                                  recommendation.maximum ??
                                  ""
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateRecommendation(
                                    index,
                                    "maximum",
                                    event
                                      .target
                                      .value,
                                  )
                                }
                                min="0"
                                className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                              />

                              <span className="mt-1 block text-xs text-ink-400">
                                {formatMoney(
                                  recommendation.maximum,
                                  recommendation.currency,
                                )}
                              </span>
                            </label>
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="rounded-lg bg-ink-50 px-4 py-3">
                              <p className="text-xs uppercase tracking-wide text-ink-400">
                                Current average
                              </p>

                              <p className="mt-1 text-sm font-semibold text-ink-800">
                                {formatMoney(
                                  recommendation.current_average,
                                  recommendation.currency,
                                )}
                              </p>
                            </div>

                            <div className="rounded-lg bg-ink-50 px-4 py-3">
                              <p className="text-xs uppercase tracking-wide text-ink-400">
                                Recommended range
                              </p>

                              <p className="mt-1 text-sm font-semibold text-ink-800">
                                {formatMoney(
                                  recommendation.minimum,
                                  recommendation.currency,
                                )}{" "}
                                –{" "}
                                {formatMoney(
                                  recommendation.maximum,
                                  recommendation.currency,
                                )}
                              </p>
                            </div>
                          </div>

                          {recommendation.is_existing &&
                            recommendation.existing_band && (
                              <div className="rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-3">
                                <p className="text-xs font-medium text-amber-800">
                                  Existing structure
                                </p>

                                <p className="mt-1 text-xs text-amber-700">
                                  {formatMoney(
                                    recommendation
                                      .existing_band
                                      .minimum,
                                    recommendation.currency,
                                  )}{" "}
                                  –{" "}
                                  {formatMoney(
                                    recommendation
                                      .existing_band
                                      .midpoint,
                                    recommendation.currency,
                                  )}{" "}
                                  –{" "}
                                  {formatMoney(
                                    recommendation
                                      .existing_band
                                      .maximum,
                                    recommendation.currency,
                                  )}
                                </p>
                              </div>
                            )}
                        </div>
                      </div>
                    );
                  },
                )}
              </div>

              <div className="flex flex-col gap-3 border-t border-ink-100 bg-ink-50/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-ink-500">
                  Review the salary ranges before
                  approving them.
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={
                      closeRecommendations
                    }
                    disabled={
                      approvingRecommendations
                    }
                    className="rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={
                      handleApproveGenerated
                    }
                    disabled={
                      approvingRecommendations ||
                      selectedRecommendations.length ===
                        0
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {approvingRecommendations ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}

                    {approvingRecommendations
                      ? "Saving..."
                      : `Approve ${selectedRecommendations.length} band${
                          selectedRecommendations.length ===
                          1
                            ? ""
                            : "s"
                        }`}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* =====================================================
          MANUAL FORM
      ===================================================== */}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="card mb-6 p-6"
        >
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink-900">
                {editingId
                  ? "Edit pay band"
                  : "Create pay band"}
              </h2>

              <p className="mt-1 text-sm text-ink-500">
                Define the salary range for
                a role level.
              </p>
            </div>

            <button
              type="button"
              onClick={resetForm}
              className="text-sm text-ink-500 hover:text-ink-900"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-ink-700">
                Job family
              </span>

              <input
                name="job_family"
                value={
                  form.job_family
                }
                onChange={
                  handleChange
                }
                placeholder="Engineering"
                className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-ink-700">
                Level
              </span>

              <input
                name="level"
                value={form.level}
                onChange={
                  handleChange
                }
                placeholder="L3 / Senior"
                className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-ink-700">
                Currency
              </span>

              <select
                name="currency"
                value={
                  form.currency
                }
                onChange={
                  handleChange
                }
                className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
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
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-ink-700">
                Status
              </span>

              <select
                name="status"
                value={
                  form.status
                }
                onChange={
                  handleChange
                }
                className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
              >
                <option value="active">
                  Active
                </option>

                <option value="draft">
                  Draft
                </option>

                <option value="archived">
                  Archived
                </option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-ink-700">
                Minimum
              </span>

              <input
                type="number"
                name="minimum"
                value={
                  form.minimum
                }
                onChange={
                  handleChange
                }
                min="0"
                step="0.01"
                placeholder="500000"
                className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-ink-700">
                Midpoint
              </span>

              <input
                type="number"
                name="midpoint"
                value={
                  form.midpoint
                }
                onChange={
                  handleChange
                }
                min="0"
                step="0.01"
                placeholder="700000"
                className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-ink-700">
                Maximum
              </span>

              <input
                type="number"
                name="maximum"
                value={
                  form.maximum
                }
                onChange={
                  handleChange
                }
                min="0"
                step="0.01"
                placeholder="900000"
                className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-ink-700">
                Notes
              </span>

              <textarea
                name="notes"
                value={
                  form.notes
                }
                onChange={
                  handleChange
                }
                rows={3}
                placeholder="Optional notes about this salary structure..."
                className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
              />
            </label>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update pay band"
                  : "Create pay band"}
            </button>
          </div>
        </form>
      )}

      {/* =====================================================
          EXISTING SALARY STRUCTURES
      ===================================================== */}

      <div className="card overflow-hidden">
        <div className="border-b border-ink-100 px-5 py-4">
          <h2 className="text-base font-semibold text-ink-900">
            Salary structures
          </h2>

          <p className="mt-1 text-sm text-ink-500">
            Organization-specific pay
            bands stored in your HR
            database.
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-ink-500">
            Loading pay structures...
          </div>
        ) : bands.length === 0 ? (
          <div className="p-10 text-center">
            <Wallet className="mx-auto h-8 w-8 text-ink-300" />

            <h3 className="mt-3 text-sm font-semibold text-ink-900">
              No pay bands yet
            </h3>

            <p className="mt-1 text-sm text-ink-500">
              Generate a structure
              automatically or create
              your first salary structure
              manually.
            </p>

            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={
                  handleGenerate
                }
                disabled={
                  generating
                }
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" />
                Generate structure
              </button>

              <button
                type="button"
                onClick={() =>
                  setShowForm(true)
                }
                className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
              >
                <Plus className="h-4 w-4" />
                Create manually
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60 text-left">
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-ink-400">
                    Job family
                  </th>

                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-ink-400">
                    Level
                  </th>

                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-ink-400">
                    Minimum
                  </th>

                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-ink-400">
                    Midpoint
                  </th>

                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-ink-400">
                    Maximum
                  </th>

                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-ink-400">
                    Status
                  </th>

                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-ink-400">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {bands.map(
                  (band) => (
                    <tr
                      key={band.id}
                      className="border-b border-ink-100 last:border-0"
                    >
                      <td className="px-5 py-4 text-sm font-medium text-ink-900">
                        {
                          band.job_family
                        }
                      </td>

                      <td className="px-5 py-4 text-sm text-ink-700">
                        {band.level}
                      </td>

                      <td className="px-5 py-4 text-sm text-ink-700">
                        {formatMoney(
                          band.minimum,
                          band.currency,
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm font-medium text-ink-900">
                        {formatMoney(
                          band.midpoint,
                          band.currency,
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm text-ink-700">
                        {formatMoney(
                          band.maximum,
                          band.currency,
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full bg-ink-50 px-2.5 py-1 text-xs font-medium capitalize text-ink-600">
                          {
                            band.status
                          }
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleEdit(
                                band,
                              )
                            }
                            className="rounded-lg p-2 text-ink-500 hover:bg-ink-50 hover:text-ink-900"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(
                                band.id,
                              )
                            }
                            className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}