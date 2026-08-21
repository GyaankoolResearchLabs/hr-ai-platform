import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  UserRound,
  ClipboardCheck,
  X,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import axios from "axios";
import { supabase } from "../../lib/supabaseClient";

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
    config.headers.Authorization =
      `Bearer ${session.access_token}`;
  }

  return config;
});

const EMPTY_CRITERION = () => ({
  id: crypto.randomUUID(),
  name: "",
  description: "",
  weight: 1,
  rating: null,
  feedback: "",
});

const DEFAULT_CRITERIA = [
  {
    id: crypto.randomUUID(),
    name: "Technical knowledge",
    description:
      "Candidate's understanding of the technical requirements of the role.",
    weight: 1,
    rating: null,
    feedback: "",
  },
  {
    id: crypto.randomUUID(),
    name: "Problem solving",
    description:
      "Ability to reason through problems and explain solutions.",
    weight: 1,
    rating: null,
    feedback: "",
  },
  {
    id: crypto.randomUUID(),
    name: "Communication",
    description:
      "Clarity, listening skills and ability to communicate effectively.",
    weight: 1,
    rating: null,
    feedback: "",
  },
];

export default function InterviewScorecards() {
  const navigate = useNavigate();

  const [scorecards, setScorecards] =
    useState([]);

  const [selectedId, setSelectedId] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [form, setForm] = useState({
    candidateName: "",
    candidateEmail: "",
    jobTitle: "",
    interviewerName: "",
    criteria: DEFAULT_CRITERIA,
    notes: "",
    status: "draft",
  });

  const selectedScorecard = useMemo(
    () =>
      scorecards.find(
        (item) => item.id === selectedId,
      ) || null,
    [scorecards, selectedId],
  );

  /*
   * ---------------------------------------------------------
   * LOAD SCORECARDS
   * ---------------------------------------------------------
   */

  const loadScorecards = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        "/interview-scorecards",
      );

      setScorecards(response.data || []);
    } catch (err) {
      console.error(
        "[Scorecards] Load failed:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          "Unable to load interview scorecards.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScorecards();
  }, []);

  /*
   * ---------------------------------------------------------
   * REALTIME UPDATES
   * ---------------------------------------------------------
   */

  useEffect(() => {
    let channel;

    async function subscribe() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      channel = supabase
        .channel(
          "interview-scorecards-realtime",
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "interview_scorecards",
          },
          () => {
            loadScorecards();
          },
        )
        .subscribe();
    }

    subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  /*
   * ---------------------------------------------------------
   * NEW SCORECARD
   * ---------------------------------------------------------
   */

  const createNew = () => {
    setSelectedId(null);

    setForm({
      candidateName: "",
      candidateEmail: "",
      jobTitle: "",
      interviewerName: "",
      criteria: [
        EMPTY_CRITERION(),
        EMPTY_CRITERION(),
        EMPTY_CRITERION(),
      ],
      notes: "",
      status: "draft",
    });

    setError("");
  };

  /*
   * ---------------------------------------------------------
   * OPEN EXISTING SCORECARD
   * ---------------------------------------------------------
   */

  const openScorecard = (scorecard) => {
    setSelectedId(scorecard.id);

    setForm({
      candidateName:
        scorecard.candidate_name || "",

      candidateEmail:
        scorecard.candidate_email || "",

      jobTitle:
        scorecard.job_title || "",

      interviewerName:
        scorecard.interviewer_name || "",

      criteria:
        Array.isArray(scorecard.criteria)
          ? scorecard.criteria
          : [],

      notes:
        scorecard.notes || "",

      status:
        scorecard.status || "draft",
    });

    setError("");
  };

  /*
   * ---------------------------------------------------------
   * FORM
   * ---------------------------------------------------------
   */

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateCriterion = (
    criterionId,
    field,
    value,
  ) => {
    setForm((current) => ({
      ...current,

      criteria: current.criteria.map(
        (criterion) =>
          criterion.id === criterionId
            ? {
                ...criterion,
                [field]: value,
              }
            : criterion,
      ),
    }));
  };

  const addCriterion = () => {
    setForm((current) => ({
      ...current,
      criteria: [
        ...current.criteria,
        EMPTY_CRITERION(),
      ],
    }));
  };

  const removeCriterion = (criterionId) => {
    setForm((current) => ({
      ...current,

      criteria: current.criteria.filter(
        (criterion) =>
          criterion.id !== criterionId,
      ),
    }));
  };

  /*
   * ---------------------------------------------------------
   * SCORE CALCULATION
   * ---------------------------------------------------------
   */

  const score = useMemo(() => {
    const rated = form.criteria.filter(
      (criterion) =>
        Number(criterion.rating) >= 1,
    );

    if (!rated.length) {
      return 0;
    }

    let weightedTotal = 0;
    let totalWeight = 0;

    rated.forEach((criterion) => {
      const weight =
        Number(criterion.weight) > 0
          ? Number(criterion.weight)
          : 1;

      weightedTotal +=
        Number(criterion.rating) * weight;

      totalWeight += weight;
    });

    return totalWeight
      ? Math.round(
          (weightedTotal /
            (totalWeight * 5)) *
            100,
        )
      : 0;
  }, [form.criteria]);

  /*
   * ---------------------------------------------------------
   * SAVE
   * ---------------------------------------------------------
   */

  const saveScorecard = async () => {
    try {
      setSaving(true);
      setError("");

      if (!form.candidateName.trim()) {
        setError(
          "Candidate name is required.",
        );
        return;
      }

      if (!form.jobTitle.trim()) {
        setError(
          "Job title is required.",
        );
        return;
      }

      if (!form.interviewerName.trim()) {
        setError(
          "Interviewer name is required.",
        );
        return;
      }

      if (!form.criteria.length) {
        setError(
          "Add at least one evaluation criterion.",
        );
        return;
      }

      const payload = {
        candidateName:
          form.candidateName,

        candidateEmail:
          form.candidateEmail,

        jobTitle:
          form.jobTitle,

        interviewerName:
          form.interviewerName,

        criteria:
          form.criteria,

        notes:
          form.notes,

        status:
          form.status,
      };

      let response;

      if (selectedId) {
        response = await api.patch(
          `/interview-scorecards/${selectedId}`,
          payload,
        );
      } else {
        response = await api.post(
          "/interview-scorecards",
          payload,
        );
      }

      const saved = response.data;

      setScorecards((current) => {
        const exists = current.some(
          (item) => item.id === saved.id,
        );

        if (exists) {
          return current.map((item) =>
            item.id === saved.id
              ? saved
              : item,
          );
        }

        return [saved, ...current];
      });

      setSelectedId(saved.id);

      setForm({
        candidateName:
          saved.candidate_name || "",

        candidateEmail:
          saved.candidate_email || "",

        jobTitle:
          saved.job_title || "",

        interviewerName:
          saved.interviewer_name || "",

        criteria:
          saved.criteria || [],

        notes:
          saved.notes || "",

        status:
          saved.status || "draft",
      });
    } catch (err) {
      console.error(
        "[Scorecards] Save failed:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          "Unable to save scorecard.",
      );
    } finally {
      setSaving(false);
    }
  };

  /*
   * ---------------------------------------------------------
   * COMPLETE INTERVIEW
   * ---------------------------------------------------------
   */

  const completeInterview = async () => {
    if (!selectedId) {
      setError(
        "Save the scorecard before completing the interview.",
      );
      return;
    }

    const incomplete = form.criteria.some(
      (criterion) =>
        !criterion.rating ||
        Number(criterion.rating) < 1,
    );

    if (incomplete) {
      setError(
        "Every criterion must be rated before completing the interview.",
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await api.patch(
        `/interview-scorecards/${selectedId}`,
        {
          criteria: form.criteria,
          notes: form.notes,
          status:
            score >= 70
              ? "recommended"
              : "not_recommended",
        },
      );

      const saved = response.data;

      setScorecards((current) =>
        current.map((item) =>
          item.id === saved.id
            ? saved
            : item,
        ),
      );

      setForm((current) => ({
        ...current,
        status: saved.status,
      }));
    } catch (err) {
      console.error(
        "[Scorecards] Complete failed:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          "Unable to complete interview.",
      );
    } finally {
      setSaving(false);
    }
  };

  /*
   * ---------------------------------------------------------
   * DELETE
   * ---------------------------------------------------------
   */

  const deleteScorecard = async () => {
    if (!selectedId) return;

    const confirmed = window.confirm(
      "Delete this interview scorecard permanently?",
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      setError("");

      await api.delete(
        `/interview-scorecards/${selectedId}`,
      );

      setScorecards((current) =>
        current.filter(
          (item) =>
            item.id !== selectedId,
        ),
      );

      createNew();
    } catch (err) {
      console.error(
        "[Scorecards] Delete failed:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          "Unable to delete scorecard.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas p-6">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}

        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() =>
                navigate(-1)
              }
              className="mb-3 flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <ClipboardCheck className="h-5 w-5" />
              </div>

              <div>
                <h1 className="text-xl font-semibold text-ink-900">
                  Structured Interview Scorecards
                </h1>

                <p className="text-sm text-ink-500">
                  Standardize interview feedback and compare candidates fairly.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={createNew}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            New scorecard
          </button>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">

          {/* EXISTING SCORECARDS */}

          <div className="card h-fit p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-900">
                Interview scorecards
              </h2>

              <span className="text-xs text-ink-400">
                {scorecards.length}
              </span>
            </div>

            {loading ? (
              <p className="text-sm text-ink-400">
                Loading...
              </p>
            ) : scorecards.length === 0 ? (
              <div className="rounded-lg bg-canvas p-4 text-center">
                <UserRound className="mx-auto mb-2 h-5 w-5 text-ink-400" />

                <p className="text-sm text-ink-600">
                  No scorecards yet.
                </p>

                <p className="mt-1 text-xs text-ink-400">
                  Create your first interview scorecard.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {scorecards.map(
                  (scorecard) => (
                    <button
                      key={scorecard.id}
                      type="button"
                      onClick={() =>
                        openScorecard(
                          scorecard,
                        )
                      }
                      className={`w-full rounded-lg border p-3 text-left transition ${
                        selectedId ===
                        scorecard.id
                          ? "border-brand-300 bg-brand-50"
                          : "border-ink-100 bg-white hover:bg-ink-50"
                      }`}
                    >
                      <p className="truncate text-sm font-medium text-ink-900">
                        {
                          scorecard.candidate_name
                        }
                      </p>

                      <p className="mt-1 truncate text-xs text-ink-500">
                        {
                          scorecard.job_title
                        }
                      </p>

                      <span className="mt-2 inline-block rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-medium capitalize text-ink-600">
                        {
                          scorecard.status?.replace(
                            "_",
                            " ",
                          )
                        }
                      </span>
                    </button>
                  ),
                )}
              </div>
            )}
          </div>

          {/* EDITOR */}

          <div className="card p-6">

            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-ink-900">
                  {selectedScorecard
                    ? "Edit interview scorecard"
                    : "Create interview scorecard"}
                </h2>

                <p className="mt-1 text-sm text-ink-500">
                  Record structured, evidence-based interview feedback.
                </p>
              </div>

              {selectedId && (
                <button
                  type="button"
                  onClick={deleteScorecard}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              )}
            </div>

            {/* CANDIDATE */}

            <div className="mb-7">
              <h3 className="mb-3 text-sm font-semibold text-ink-900">
                Candidate details
              </h3>

              <div className="grid gap-4 md:grid-cols-2">

                <input
                  value={form.candidateName}
                  onChange={(event) =>
                    updateField(
                      "candidateName",
                      event.target.value,
                    )
                  }
                  placeholder="Candidate name"
                  className="rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                />

                <input
                  value={form.candidateEmail}
                  onChange={(event) =>
                    updateField(
                      "candidateEmail",
                      event.target.value,
                    )
                  }
                  placeholder="Candidate email"
                  type="email"
                  className="rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                />

                <input
                  value={form.jobTitle}
                  onChange={(event) =>
                    updateField(
                      "jobTitle",
                      event.target.value,
                    )
                  }
                  placeholder="Job title"
                  className="rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                />

                <input
                  value={form.interviewerName}
                  onChange={(event) =>
                    updateField(
                      "interviewerName",
                      event.target.value,
                    )
                  }
                  placeholder="Interviewer name"
                  className="rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                />

              </div>
            </div>

            {/* SCORE */}

            <div className="mb-7 rounded-xl bg-canvas p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                    Current score
                  </p>

                  <p className="mt-1 text-3xl font-semibold text-ink-900">
                    {score}%
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs text-ink-400">
                    Status
                  </p>

                  <p className="mt-1 text-sm font-medium capitalize text-ink-700">
                    {form.status.replace(
                      "_",
                      " ",
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* CRITERIA */}

            <div className="mb-7">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-ink-900">
                    Evaluation criteria
                  </h3>

                  <p className="mt-1 text-xs text-ink-400">
                    Rate each criterion from 1 to 5.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addCriterion}
                  className="flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add criterion
                </button>
              </div>

              <div className="space-y-4">
                {form.criteria.map(
                  (criterion, index) => (
                    <div
                      key={criterion.id}
                      className="rounded-xl border border-ink-100 p-4"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <label className="mb-1 block text-xs font-medium text-ink-400">
                            Criterion {index + 1}
                          </label>

                          <input
                            value={
                              criterion.name
                            }
                            onChange={(
                              event,
                            ) =>
                              updateCriterion(
                                criterion.id,
                                "name",
                                event.target
                                  .value,
                              )
                            }
                            placeholder="e.g. Leadership"
                            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            removeCriterion(
                              criterion.id,
                            )
                          }
                          className="mt-5 rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600"
                          title="Remove criterion"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <textarea
                        value={
                          criterion.description
                        }
                        onChange={(
                          event,
                        ) =>
                          updateCriterion(
                            criterion.id,
                            "description",
                            event.target
                              .value,
                          )
                        }
                        placeholder="What should the interviewer evaluate?"
                        rows={2}
                        className="mb-3 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                      />

                      <div className="grid gap-4 md:grid-cols-[120px_1fr]">

                        <div>
                          <label className="mb-1 block text-xs font-medium text-ink-400">
                            Weight
                          </label>

                          <input
                            type="number"
                            min="1"
                            value={
                              criterion.weight
                            }
                            onChange={(
                              event,
                            ) =>
                              updateCriterion(
                                criterion.id,
                                "weight",
                                Number(
                                  event.target
                                    .value,
                                ),
                              )
                            }
                            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-ink-400">
                            Rating
                          </label>

                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map(
                              (rating) => (
                                <button
                                  key={rating}
                                  type="button"
                                  onClick={() =>
                                    updateCriterion(
                                      criterion.id,
                                      "rating",
                                      rating,
                                    )
                                  }
                                  className={`h-9 w-9 rounded-lg border text-sm font-medium ${
                                    Number(
                                      criterion.rating,
                                    ) ===
                                    rating
                                      ? "border-brand-600 bg-brand-600 text-white"
                                      : "border-ink-200 text-ink-600 hover:bg-ink-50"
                                  }`}
                                >
                                  {rating}
                                </button>
                              ),
                            )}
                          </div>
                        </div>
                      </div>

                      <textarea
                        value={
                          criterion.feedback
                        }
                        onChange={(
                          event,
                        ) =>
                          updateCriterion(
                            criterion.id,
                            "feedback",
                            event.target
                              .value,
                          )
                        }
                        placeholder="Evidence / interviewer feedback"
                        rows={3}
                        className="mt-3 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                      />
                    </div>
                  ),
                )}
              </div>
            </div>

            {/* NOTES */}

            <div className="mb-7">
              <label className="mb-2 block text-sm font-semibold text-ink-900">
                Overall notes
              </label>

              <textarea
                value={form.notes}
                onChange={(event) =>
                  updateField(
                    "notes",
                    event.target.value,
                  )
                }
                rows={5}
                placeholder="Add overall interview observations..."
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-3 text-sm outline-none focus:border-brand-500"
              />
            </div>

            {/* ACTIONS */}

            <div className="flex flex-wrap justify-end gap-3 border-t border-ink-100 pt-5">

              <button
                type="button"
                onClick={() =>
                  navigate(-1)
                }
                className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
              >
                Back
              </button>

              <button
                type="button"
                onClick={saveScorecard}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving
                  ? "Saving..."
                  : "Save draft"}
              </button>

              <button
                type="button"
                onClick={completeInterview}
                disabled={
                  saving ||
                  !selectedId
                }
                className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                Complete interview
              </button>

            </div>

          </div>
        </div>
      </div>
    </div>
  );
}