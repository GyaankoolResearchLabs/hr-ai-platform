import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  Search,
  Plus,
  Users,
  Pencil,
  Trash2,
  RefreshCw,
  X,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import api from "../../lib/api";

const STAGES = [
  "Applied",
  "Screening",
  "Interview",
  "Offer",
  "Hired",
  "Rejected",
];

const EMPTY_FORM = {
  candidateName: "",
  candidateEmail: "",
  jobTitle: "",
  stage: "Applied",
  notes: "",
};

export default function HiringPipelineTracker() {
  const navigate = useNavigate();

  const [candidates, setCandidates] =
    useState([]);

  const [counts, setCounts] =
    useState({});

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [stageFilter, setStageFilter] =
    useState("All");

  const [showModal, setShowModal] =
    useState(false);

  const [editingCandidate, setEditingCandidate] =
    useState(null);

  const [form, setForm] =
    useState(EMPTY_FORM);

  /* =======================================================
     LOAD PIPELINE
  ======================================================= */

  const loadPipeline = useCallback(
    async (silent = false) => {
      try {
        if (!silent) {
          setLoading(true);
        }

        const response =
          await api.get(
            "/hiring-pipeline"
          );

        setCandidates(
          response.data?.candidates ||
            []
        );

        setCounts(
          response.data?.counts ||
            {}
        );
      } catch (error) {
        console.error(
          "Failed to load hiring pipeline:",
          error
        );

        toast.error(
          error?.response?.data
            ?.message ||
            "Failed to load hiring pipeline."
        );
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    []
  );

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    loadPipeline();
  }, [loadPipeline]);

  /* =======================================================
     LIVE REFRESH
     
     The backend remains the source of truth.
     Poll every 5 seconds so multiple users see
     candidate changes without manually refreshing.
  ======================================================= */

  useEffect(() => {
    const interval =
      setInterval(() => {
        loadPipeline(true);
      }, 5000);

    return () =>
      clearInterval(interval);
  }, [loadPipeline]);

  /* =======================================================
     FORM
  ======================================================= */

  const openCreateModal = () => {
    setEditingCandidate(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEditModal = (
    candidate
  ) => {
    setEditingCandidate(candidate);

    setForm({
      candidateName:
        candidate.candidate_name ||
        "",

      candidateEmail:
        candidate.candidate_email ||
        "",

      jobTitle:
        candidate.job_title ||
        "",

      stage:
        candidate.stage ||
        "Applied",

      notes:
        candidate.notes ||
        "",
    });

    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditingCandidate(null);
    setForm(EMPTY_FORM);
  };

  const handleChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  /* =======================================================
     SAVE
  ======================================================= */

  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    if (
      !form.candidateName.trim()
    ) {
      toast.error(
        "Candidate name is required."
      );
      return;
    }

    if (!form.jobTitle.trim()) {
      toast.error(
        "Job title is required."
      );
      return;
    }

    try {
      setSaving(true);

      if (editingCandidate) {
        await api.patch(
          `/hiring-pipeline/${editingCandidate.id}`,
          form
        );

        toast.success(
          "Candidate updated."
        );
      } else {
        await api.post(
          "/hiring-pipeline",
          form
        );

        toast.success(
          "Candidate added to pipeline."
        );
      }

      closeModal();

      await loadPipeline(true);
    } catch (error) {
      console.error(
        "Failed to save candidate:",
        error
      );

      toast.error(
        error?.response?.data
          ?.message ||
          "Failed to save candidate."
      );
    } finally {
      setSaving(false);
    }
  };

  /* =======================================================
     MOVE STAGE
  ======================================================= */

  const handleStageChange = async (
    candidate,
    stage
  ) => {
    if (
      candidate.stage === stage
    ) {
      return;
    }

    try {
      await api.patch(
        `/hiring-pipeline/${candidate.id}/stage`,
        { stage }
      );

      toast.success(
        `${candidate.candidate_name} moved to ${stage}.`
      );

      await loadPipeline(true);
    } catch (error) {
      console.error(
        "Failed to move candidate:",
        error
      );

      toast.error(
        error?.response?.data
          ?.message ||
          "Failed to move candidate."
      );
    }
  };

  /* =======================================================
     DELETE
  ======================================================= */

  const handleDelete = async (
    candidate
  ) => {
    const confirmed =
      window.confirm(
        `Delete ${candidate.candidate_name} from the hiring pipeline?`
      );

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(
        `/hiring-pipeline/${candidate.id}`
      );

      toast.success(
        "Candidate removed from pipeline."
      );

      await loadPipeline(true);
    } catch (error) {
      console.error(
        "Failed to delete candidate:",
        error
      );

      toast.error(
        error?.response?.data
          ?.message ||
          "Failed to delete candidate."
      );
    }
  };

  /* =======================================================
     FILTER
  ======================================================= */

  const filteredCandidates =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      return candidates.filter(
        (candidate) => {
          const matchesStage =
            stageFilter === "All" ||
            candidate.stage ===
              stageFilter;

          if (!matchesStage) {
            return false;
          }

          if (!term) {
            return true;
          }

          return (
            candidate.candidate_name
              ?.toLowerCase()
              .includes(term) ||
            candidate.candidate_email
              ?.toLowerCase()
              .includes(term) ||
            candidate.job_title
              ?.toLowerCase()
              .includes(term)
          );
        }
      );
    }, [
      candidates,
      search,
      stageFilter,
    ]);

  /* =======================================================
     GROUP BY STAGE
  ======================================================= */

  const groupedCandidates =
    useMemo(() => {
      return STAGES.reduce(
        (result, stage) => {
          result[stage] =
            filteredCandidates.filter(
              (candidate) =>
                candidate.stage ===
                stage
            );

          return result;
        },
        {}
      );
    }, [filteredCandidates]);

  /* =======================================================
     DATE
  ======================================================= */

  const formatDate = (
    value
  ) => {
    if (!value) return "—";

    return new Date(
      value
    ).toLocaleDateString(
      undefined,
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

          <div>
            <button
              type="button"
              onClick={() =>
                navigate(-1)
              }
              className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink-500 transition hover:text-ink-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <Users className="h-5 w-5" />
              </div>

              <div>
                <h1 className="text-2xl font-semibold text-ink-900">
                  Hiring Pipeline Tracker
                </h1>

                <p className="mt-1 text-sm text-ink-500">
                  Shared, real-time candidate pipeline status.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Add candidate
          </button>
        </div>

        {/* =================================================
            CONTROLS
        ================================================= */}

        <div className="mb-6 rounded-xl border border-ink-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search candidates or jobs..."
                className="w-full rounded-lg border border-ink-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={stageFilter}
                onChange={(event) =>
                  setStageFilter(
                    event.target.value
                  )
                }
                className="rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-700 outline-none focus:border-brand-500"
              >
                <option value="All">
                  All stages
                </option>

                {STAGES.map(
                  (stage) => (
                    <option
                      key={stage}
                      value={stage}
                    >
                      {stage}
                    </option>
                  )
                )}
              </select>

              <button
                type="button"
                onClick={() =>
                  loadPipeline()
                }
                className="inline-flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2.5 text-sm font-medium text-ink-600 transition hover:bg-ink-50"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* =================================================
            STAGE SUMMARY
        ================================================= */}

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {STAGES.map(
            (stage) => (
              <button
                key={stage}
                type="button"
                onClick={() =>
                  setStageFilter(
                    stage
                  )
                }
                className={`rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-brand-300 ${
                  stageFilter === stage
                    ? "border-brand-500 ring-2 ring-brand-100"
                    : "border-ink-100"
                }`}
              >
                <p className="text-xs font-medium text-ink-400">
                  {stage}
                </p>

                <p className="mt-1 text-2xl font-semibold text-ink-900">
                  {counts[stage] ||
                    0}
                </p>
              </button>
            )
          )}
        </div>

        {/* =================================================
            PIPELINE
        ================================================= */}

        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-ink-100 bg-white">
            <RefreshCw className="h-6 w-6 animate-spin text-brand-600" />
          </div>
        ) : (
          <div className="grid min-w-0 gap-4 xl:grid-cols-6">

            {STAGES.map(
              (stage) => (
                <div
                  key={stage}
                  className="min-w-0 rounded-xl border border-ink-100 bg-white shadow-sm"
                >
                  {/* COLUMN HEADER */}

                  <div className="border-b border-ink-100 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold text-ink-900">
                        {stage}
                      </h2>

                      <span className="rounded-full bg-ink-50 px-2 py-0.5 text-xs font-medium text-ink-500">
                        {groupedCandidates[
                          stage
                        ]?.length || 0}
                      </span>
                    </div>
                  </div>

                  {/* CANDIDATES */}

                  <div className="space-y-3 p-3">
                    {groupedCandidates[
                      stage
                    ]?.length ? (
                      groupedCandidates[
                        stage
                      ].map(
                        (
                          candidate
                        ) => (
                          <div
                            key={
                              candidate.id
                            }
                            className="rounded-lg border border-ink-100 bg-canvas p-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-ink-900">
                                  {
                                    candidate.candidate_name
                                  }
                                </p>

                                <p className="mt-1 truncate text-xs text-ink-500">
                                  {
                                    candidate.job_title
                                  }
                                </p>
                              </div>

                              <div className="flex shrink-0 items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openEditModal(
                                      candidate
                                    )
                                  }
                                  className="rounded-md p-1.5 text-ink-400 transition hover:bg-white hover:text-brand-600"
                                  title="Edit candidate"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDelete(
                                      candidate
                                    )
                                  }
                                  className="rounded-md p-1.5 text-ink-400 transition hover:bg-white hover:text-red-600"
                                  title="Delete candidate"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            {candidate.candidate_email && (
                              <p className="mt-2 truncate text-xs text-ink-500">
                                {
                                  candidate.candidate_email
                                }
                              </p>
                            )}

                            <p className="mt-2 text-[11px] text-ink-400">
                              Added{" "}
                              {formatDate(
                                candidate.created_at
                              )}
                            </p>

                            {/* MOVE */}

                            <select
                              value={
                                candidate.stage
                              }
                              onChange={(
                                event
                              ) =>
                                handleStageChange(
                                  candidate,
                                  event.target
                                    .value
                                )
                              }
                              className="mt-3 w-full rounded-md border border-ink-200 bg-white px-2 py-1.5 text-xs text-ink-700 outline-none focus:border-brand-500"
                            >
                              {STAGES.map(
                                (
                                  stageOption
                                ) => (
                                  <option
                                    key={
                                      stageOption
                                    }
                                    value={
                                      stageOption
                                    }
                                  >
                                    Move to{" "}
                                    {
                                      stageOption
                                    }
                                  </option>
                                )
                              )}
                            </select>
                          </div>
                        )
                      )
                    ) : (
                      <div className="rounded-lg border border-dashed border-ink-200 p-5 text-center">
                        <p className="text-xs text-ink-400">
                          No candidates
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* =================================================
            CREATE / EDIT MODAL
        ================================================= */}

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">

              <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-ink-900">
                    {editingCandidate
                      ? "Edit candidate"
                      : "Add candidate"}
                  </h2>

                  <p className="mt-1 text-xs text-ink-400">
                    Keep candidate pipeline information current.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg p-2 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form
                onSubmit={
                  handleSubmit
                }
                className="space-y-5 p-5"
              >
                <div className="grid gap-4 md:grid-cols-2">

                  <div>
                    <label className="text-sm font-medium text-ink-700">
                      Candidate name
                    </label>

                    <input
                      name="candidateName"
                      value={
                        form.candidateName
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Candidate name"
                      className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-ink-700">
                      Candidate email
                    </label>

                    <input
                      type="email"
                      name="candidateEmail"
                      value={
                        form.candidateEmail
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="candidate@example.com"
                      className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-ink-700">
                      Job title
                    </label>

                    <input
                      name="jobTitle"
                      value={
                        form.jobTitle
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="e.g. Software Engineer"
                      className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-ink-700">
                      Pipeline stage
                    </label>

                    <select
                      name="stage"
                      value={
                        form.stage
                      }
                      onChange={
                        handleChange
                      }
                      className="mt-1.5 w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                    >
                      {STAGES.map(
                        (stage) => (
                          <option
                            key={stage}
                            value={stage}
                          >
                            {stage}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-ink-700">
                    Notes
                  </label>

                  <textarea
                    name="notes"
                    value={
                      form.notes
                    }
                    onChange={
                      handleChange
                    }
                    rows={4}
                    placeholder="Interview notes, next action, recruiter notes..."
                    className="mt-1.5 w-full resize-none rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </div>

                <div className="flex justify-end gap-3 border-t border-ink-100 pt-4">
                  <button
                    type="button"
                    onClick={
                      closeModal
                    }
                    disabled={saving}
                    className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-medium text-ink-600 hover:bg-ink-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving && (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    )}

                    {editingCandidate
                      ? "Save changes"
                      : "Add candidate"}
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