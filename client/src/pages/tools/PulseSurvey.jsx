import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Check,
  ChevronDown,
  ClipboardList,
  Clock3,
  FileText,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../../services/api";

const QUESTION_TYPES = [
  {
    value: "text",
    label: "Text response",
  },
  {
    value: "rating",
    label: "Rating",
  },
  {
    value: "single_choice",
    label: "Single choice",
  },
  {
    value: "multiple_choice",
    label: "Multiple choice",
  },
];

const EMPTY_QUESTION = {
  question_text: "",
  question_type: "rating",
  options: ["", ""],
  required: true,
};

export default function PulseSurvey() {
  const navigate = useNavigate();

  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [selectedResults, setSelectedResults] = useState(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  const [showTakeSurvey, setShowTakeSurvey] = useState(false);
  const [responseAnswers, setResponseAnswers] = useState({});
  const [employeeId, setEmployeeId] = useState("");
  const [submittingResponse, setSubmittingResponse] =
    useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    isAnonymous: true,
    startsAt: "",
    endsAt: "",
    questions: [
      {
        ...EMPTY_QUESTION,
        options: ["", ""],
      },
    ],
  });

  const loadSurveys = async (isRefresh = false) => {
    try {
      setError("");

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await api.get("/pulse-surveys");

      setSurveys(
        Array.isArray(response?.data?.surveys)
          ? response.data.surveys
          : [],
      );
    } catch (err) {
      console.error(
        "[PulseSurvey] Load failed:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load pulse surveys.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSurveys();
  }, []);

  const filteredSurveys = useMemo(() => {
    const query = search.trim().toLowerCase();

    return surveys.filter((survey) => {
      const matchesStatus =
        statusFilter === "all" ||
        survey?.status === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        survey?.title,
        survey?.description,
        survey?.status,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(query),
        );
    });
  }, [surveys, search, statusFilter]);

  const totalSurveys = surveys.length;

  const draftCount = surveys.filter(
    (survey) => survey?.status === "draft",
  ).length;

  const publishedCount = surveys.filter(
    (survey) => survey?.status === "published",
  ).length;

  const closedCount = surveys.filter(
    (survey) => survey?.status === "closed",
  ).length;

  const openCreate = () => {
    setForm({
      title: "",
      description: "",
      isAnonymous: true,
      startsAt: "",
      endsAt: "",
      questions: [
        {
          ...EMPTY_QUESTION,
          options: ["", ""],
        },
      ],
    });

    setShowCreate(true);
  };

  const closeCreate = () => {
    if (saving) return;

    setShowCreate(false);
  };

  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const addQuestion = () => {
    setForm((current) => ({
      ...current,
      questions: [
        ...current.questions,
        {
          ...EMPTY_QUESTION,
          options: ["", ""],
        },
      ],
    }));
  };

  const removeQuestion = (index) => {
    setForm((current) => {
      if (current.questions.length === 1) {
        toast.error(
          "A survey needs at least one question.",
        );
        return current;
      }

      return {
        ...current,
        questions: current.questions.filter(
          (_, questionIndex) =>
            questionIndex !== index,
        ),
      };
    });
  };

  const updateQuestion = (
    questionIndex,
    field,
    value,
  ) => {
    setForm((current) => ({
      ...current,
      questions: current.questions.map(
        (question, index) => {
          if (index !== questionIndex) {
            return question;
          }

          if (field === "question_type") {
            const needsOptions =
              value === "single_choice" ||
              value === "multiple_choice";

            return {
              ...question,
              question_type: value,
              options: needsOptions
                ? question.options?.length
                  ? question.options
                  : ["", ""]
                : null,
            };
          }

          return {
            ...question,
            [field]: value,
          };
        },
      ),
    }));
  };

  const updateOption = (
    questionIndex,
    optionIndex,
    value,
  ) => {
    setForm((current) => ({
      ...current,
      questions: current.questions.map(
        (question, index) => {
          if (index !== questionIndex) {
            return question;
          }

          return {
            ...question,
            options: (
              question.options || []
            ).map((option, index) =>
              index === optionIndex
                ? value
                : option,
            ),
          };
        },
      ),
    }));
  };

  const addOption = (questionIndex) => {
    setForm((current) => ({
      ...current,
      questions: current.questions.map(
        (question, index) => {
          if (index !== questionIndex) {
            return question;
          }

          return {
            ...question,
            options: [
              ...(question.options || []),
              "",
            ],
          };
        },
      ),
    }));
  };

  const removeOption = (
    questionIndex,
    optionIndex,
  ) => {
    setForm((current) => ({
      ...current,
      questions: current.questions.map(
        (question, index) => {
          if (index !== questionIndex) {
            return question;
          }

          const options =
            question.options || [];

          if (options.length <= 1) {
            return question;
          }

          return {
            ...question,
            options: options.filter(
              (_, currentIndex) =>
                currentIndex !== optionIndex,
            ),
          };
        },
      ),
    }));
  };

  const validateForm = () => {
    if (!form.title.trim()) {
      toast.error("Survey title is required.");
      return false;
    }

    if (form.questions.length === 0) {
      toast.error(
        "Add at least one survey question.",
      );
      return false;
    }

    for (
      let index = 0;
      index < form.questions.length;
      index += 1
    ) {
      const question = form.questions[index];

      if (!question.question_text.trim()) {
        toast.error(
          `Question ${index + 1} text is required.`,
        );
        return false;
      }

      const needsOptions =
        question.question_type ===
          "single_choice" ||
        question.question_type ===
          "multiple_choice";

      if (needsOptions) {
        const validOptions = (
          question.options || []
        ).filter((option) =>
          String(option).trim(),
        );

        if (validOptions.length === 0) {
          toast.error(
            `Add at least one option to question ${
              index + 1
            }.`,
          );
          return false;
        }
      }
    }

    if (
      form.startsAt &&
      form.endsAt &&
      new Date(form.endsAt) <=
        new Date(form.startsAt)
    ) {
      toast.error(
        "End time must be after the start time.",
      );
      return false;
    }

    return true;
  };

  const createSurvey = async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);

      const questions =
        form.questions.map(
          (question, index) => {
            const needsOptions =
              question.question_type ===
                "single_choice" ||
              question.question_type ===
                "multiple_choice";

            return {
              question_text:
                question.question_text.trim(),

              question_type:
                question.question_type,

              options: needsOptions
                ? (question.options || [])
                    .map((option) =>
                      String(option).trim(),
                    )
                    .filter(Boolean)
                : null,

              display_order: index,

              required:
                question.required !== false,
            };
          },
        );

      const response = await api.post(
        "/pulse-surveys",
        {
          title: form.title.trim(),
          description:
            form.description.trim() || null,
          isAnonymous:
            form.isAnonymous,
          startsAt:
            form.startsAt
              ? new Date(
                  form.startsAt,
                ).toISOString()
              : null,
          endsAt:
            form.endsAt
              ? new Date(
                  form.endsAt,
                ).toISOString()
              : null,
          questions,
        },
      );

      const created =
        response?.data?.survey;

      toast.success(
        "Pulse survey created successfully.",
      );

      setShowCreate(false);

      if (created) {
        setSurveys((current) => [
          created,
          ...current,
        ]);
      } else {
        await loadSurveys(true);
      }
    } catch (err) {
      console.error(
        "[PulseSurvey] Create failed:",
        err,
      );

      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to create pulse survey.",
      );
    } finally {
      setSaving(false);
    }
  };

  const publishSurvey = async (survey) => {
    if (!survey?.id) return;

    try {
      const response = await api.post(
        `/pulse-surveys/${survey.id}/publish`,
      );

      const updated =
        response?.data?.survey;

      toast.success(
        "Pulse survey published successfully.",
      );

      setSurveys((current) =>
        current.map((item) =>
          item.id === survey.id
            ? {
                ...item,
                ...(updated || {}),
                status:
                  updated?.status ||
                  "published",
              }
            : item,
        ),
      );

      if (
        selectedSurvey?.id === survey.id
      ) {
        setSelectedSurvey((current) => ({
          ...current,
          ...(updated || {}),
          status:
            updated?.status ||
            "published",
        }));
      }
    } catch (err) {
      console.error(
        "[PulseSurvey] Publish failed:",
        err,
      );

      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to publish survey.",
      );
    }
  };

  const closeSurvey = async (survey) => {
    if (!survey?.id) return;

    try {
      const response = await api.post(
        `/pulse-surveys/${survey.id}/close`,
      );

      const updated =
        response?.data?.survey;

      toast.success(
        "Pulse survey closed successfully.",
      );

      setSurveys((current) =>
        current.map((item) =>
          item.id === survey.id
            ? {
                ...item,
                ...(updated || {}),
                status:
                  updated?.status ||
                  "closed",
              }
            : item,
        ),
      );

      if (
        selectedSurvey?.id === survey.id
      ) {
        setSelectedSurvey((current) => ({
          ...current,
          ...(updated || {}),
          status:
            updated?.status ||
            "closed",
        }));
      }
    } catch (err) {
      console.error(
        "[PulseSurvey] Close failed:",
        err,
      );

      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to close survey.",
      );
    }
  };

  const loadSurveyResults = async (survey) => {
    if (!survey?.id) return;

    try {
      setResultsLoading(true);
      setSelectedResults(null);

      const response = await api.get(
        `/pulse-surveys/${survey.id}/results`,
      );

      setSelectedSurvey(survey);
      setSelectedResults(
        response?.data?.results || null,
      );
    } catch (err) {
      console.error(
        "[PulseSurvey] Results failed:",
        err,
      );

      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load survey results.",
      );
    } finally {
      setResultsLoading(false);
    }
  };

  const openSurvey = async (survey) => {
    try {
      const response = await api.get(
        `/pulse-surveys/${survey.id}`,
      );

      setSelectedSurvey(
        response?.data?.survey ||
          survey,
      );

      setSelectedResults(null);
    } catch (err) {
      console.error(
        "[PulseSurvey] Single survey failed:",
        err,
      );

      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load survey.",
      );
    }
  };

  const openTakeSurvey = async (survey) => {
    try {
      const response = await api.get(
        `/pulse-surveys/${survey.id}`,
      );

      setSelectedSurvey(
        response?.data?.survey ||
          survey,
      );

      setResponseAnswers({});
      setEmployeeId("");
      setSelectedResults(null);
      setShowTakeSurvey(true);
    } catch (err) {
      console.error(
        "[PulseSurvey] Take survey failed:",
        err,
      );

      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load survey.",
      );
    }
  };

  const submitResponse = async (event) => {
    event.preventDefault();

    if (!selectedSurvey?.id) {
      return;
    }

    const questions =
      selectedSurvey
        ?.pulse_survey_questions || [];

    const answers = questions.map(
      (question) => {
        const value =
          responseAnswers[question.id];

        if (
          question.question_type ===
          "text"
        ) {
          return {
            question_id: question.id,
            answer_text:
              value || null,
          };
        }

        if (
          question.question_type ===
          "rating"
        ) {
          return {
            question_id: question.id,
            answer_value:
              value === undefined ||
              value === ""
                ? null
                : Number(value),
          };
        }

        if (
          question.question_type ===
          "multiple_choice"
        ) {
          return {
            question_id: question.id,
            answer_options:
              Array.isArray(value)
                ? value
                : [],
          };
        }

        return {
          question_id: question.id,
          answer_text:
            value || null,
        };
      },
    );

    for (const question of questions) {
      const value =
        responseAnswers[question.id];

      const missing =
        question.required &&
        (value === undefined ||
          value === null ||
          value === "" ||
          (Array.isArray(value) &&
            value.length === 0));

      if (missing) {
        toast.error(
          `Please answer: ${question.question_text}`,
        );
        return;
      }
    }

    try {
      setSubmittingResponse(true);

      await api.post(
        `/pulse-surveys/${selectedSurvey.id}/responses`,
        {
          employeeId:
            selectedSurvey.is_anonymous
              ? null
              : employeeId.trim() || null,
          answers,
        },
      );

      toast.success(
        "Survey response submitted successfully.",
      );

      setShowTakeSurvey(false);
      setResponseAnswers({});

      await loadSurveyResults(
        selectedSurvey,
      );
    } catch (err) {
      console.error(
        "[PulseSurvey] Response failed:",
        err,
      );

      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to submit response.",
      );
    } finally {
      setSubmittingResponse(false);
    }
  };

  const updateDraftMetadata = async () => {
    if (!selectedSurvey?.id) {
      return;
    }

    const title =
      window.prompt(
        "Survey title",
        selectedSurvey.title || "",
      );

    if (title === null) {
      return;
    }

    if (!title.trim()) {
      toast.error(
        "Survey title is required.",
      );
      return;
    }

    const description =
      window.prompt(
        "Survey description",
        selectedSurvey.description ||
          "",
      );

    if (description === null) {
      return;
    }

    try {
      const response = await api.patch(
        `/pulse-surveys/${selectedSurvey.id}`,
        {
          title: title.trim(),
          description:
            description.trim() || null,
        },
      );

      const updated =
        response?.data?.survey;

      setSelectedSurvey(updated);

      setSurveys((current) =>
        current.map((item) =>
          item.id === selectedSurvey.id
            ? {
                ...item,
                ...(updated || {}),
              }
            : item,
        ),
      );

      toast.success(
        "Pulse survey updated successfully.",
      );
    } catch (err) {
      console.error(
        "[PulseSurvey] Update failed:",
        err,
      );

      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to update survey.",
      );
    }
  };

  const setAnswer = (
    questionId,
    value,
  ) => {
    setResponseAnswers((current) => ({
      ...current,
      [questionId]: value,
    }));
  };

  const toggleMultipleChoice = (
    questionId,
    option,
  ) => {
    setResponseAnswers((current) => {
      const currentValues =
        Array.isArray(
          current[questionId],
        )
          ? current[questionId]
          : [];

      const exists =
        currentValues.includes(option);

      return {
        ...current,
        [questionId]: exists
          ? currentValues.filter(
              (item) => item !== option,
            )
          : [
              ...currentValues,
              option,
            ],
      };
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-80 animate-pulse rounded-lg bg-ink-100" />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-xl bg-ink-50"
            />
          ))}
        </div>

        <div className="h-96 animate-pulse rounded-xl bg-ink-50" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-medium text-red-700">
            {error}
          </p>

          <button
            type="button"
            onClick={() =>
              loadSurveys(true)
            }
            className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (showTakeSurvey) {
    return (
      <TakeSurveyView
        survey={selectedSurvey}
        answers={responseAnswers}
        employeeId={employeeId}
        setEmployeeId={setEmployeeId}
        setAnswer={setAnswer}
        toggleMultipleChoice={
          toggleMultipleChoice
        }
        submitting={submittingResponse}
        onSubmit={submitResponse}
        onBack={() =>
          setShowTakeSurvey(false)
        }
      />
    );
  }

  if (selectedSurvey) {
    return (
      <SurveyDetail
        survey={selectedSurvey}
        results={selectedResults}
        resultsLoading={resultsLoading}
        onBack={() => {
          setSelectedSurvey(null);
          setSelectedResults(null);
        }}
        onPublish={publishSurvey}
        onClose={closeSurvey}
        onResults={loadSurveyResults}
        onTake={openTakeSurvey}
        onEdit={updateDraftMetadata}
      />
    );
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-4 inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Sparkles
                className="h-5 w-5"
                strokeWidth={1.75}
              />
            </span>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-semibold text-ink-950">
                  Pulse Survey & Sentiment Tool
                </h1>

                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Live
                </span>
              </div>

              <p className="mt-1 text-sm text-ink-500">
                Frequent pulses with fast,
                readable results.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              loadSurveys(true)
            }
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
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
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Create survey
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={ClipboardList}
          label="Total surveys"
          value={totalSurveys}
        />

        <MetricCard
          icon={FileText}
          label="Drafts"
          value={draftCount}
        />

        <MetricCard
          icon={Send}
          label="Published"
          value={publishedCount}
        />

        <MetricCard
          icon={Clock3}
          label="Closed"
          value={closedCount}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-ink-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink-900">
              Pulse surveys
            </h2>

            <p className="mt-1 text-sm text-ink-500">
              Create short surveys, publish
              them, collect responses, and
              review live results.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search surveys..."
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 sm:w-64"
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value,
                )
              }
              className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700 outline-none focus:border-brand-500"
            >
              <option value="all">
                All statuses
              </option>
              <option value="draft">
                Draft
              </option>
              <option value="published">
                Published
              </option>
              <option value="closed">
                Closed
              </option>
            </select>
          </div>
        </div>

        {filteredSurveys.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-ink-50 text-ink-500">
              <ClipboardList className="h-6 w-6" />
            </div>

            <h3 className="mt-4 text-sm font-semibold text-ink-900">
              No pulse surveys found
            </h3>

            <p className="mt-1 text-sm text-ink-500">
              Create your first survey to
              start collecting employee
              feedback.
            </p>

            <button
              type="button"
              onClick={openCreate}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" />
              Create survey
            </button>
          </div>
        ) : (
          <div className="divide-y divide-ink-100">
            {filteredSurveys.map(
              (survey) => (
                <SurveyRow
                  key={survey.id}
                  survey={survey}
                  onOpen={openSurvey}
                  onPublish={publishSurvey}
                  onClose={closeSurvey}
                  onResults={
                    loadSurveyResults
                  }
                  onTake={openTakeSurvey}
                />
              ),
            )}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateSurveyModal
          form={form}
          saving={saving}
          onClose={closeCreate}
          onSubmit={createSurvey}
          onChange={updateForm}
          onAddQuestion={addQuestion}
          onRemoveQuestion={
            removeQuestion
          }
          onUpdateQuestion={
            updateQuestion
          }
          onUpdateOption={updateOption}
          onAddOption={addOption}
          onRemoveOption={
            removeOption
          }
        />
      )}
    </div>
  );
}

function SurveyRow({
  survey,
  onOpen,
  onPublish,
  onClose,
  onResults,
  onTake,
}) {
  const status = survey?.status;

  return (
    <div className="px-5 py-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <button
          type="button"
          onClick={() => onOpen(survey)}
          className="min-w-0 text-left"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <ClipboardList className="h-5 w-5" />
            </span>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-sm font-semibold text-ink-900">
                  {survey?.title ||
                    "Untitled survey"}
                </h3>

                <StatusBadge
                  status={status}
                />
              </div>

              <p className="mt-1 line-clamp-2 text-sm text-ink-500">
                {survey?.description ||
                  "No survey description."}
              </p>

              <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-400">
                <span>
                  {Array.isArray(
                    survey?.pulse_survey_questions,
                  )
                    ? survey
                        .pulse_survey_questions
                        .length
                    : 0}{" "}
                  questions
                </span>

                <span>
                  Created{" "}
                  {formatDate(
                    survey?.created_at,
                  )}
                </span>

                {survey?.is_anonymous && (
                  <span>
                    Anonymous
                  </span>
                )}
              </div>
            </div>
          </div>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {status === "draft" && (
            <>
              <button
                type="button"
                onClick={() =>
                  onPublish(survey)
                }
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-700"
              >
                <Send className="h-3.5 w-3.5" />
                Publish
              </button>

              <button
                type="button"
                onClick={() =>
                  onOpen(survey)
                }
                className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50"
              >
                Open
              </button>
            </>
          )}

          {status === "published" && (
            <>
              <button
                type="button"
                onClick={() =>
                  onTake(survey)
                }
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-700"
              >
                <ClipboardList className="h-3.5 w-3.5" />
                Take survey
              </button>

              <button
                type="button"
                onClick={() =>
                  onResults(survey)
                }
                className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Results
              </button>

              <button
                type="button"
                onClick={() =>
                  onClose(survey)
                }
                className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50"
              >
                Close
              </button>
            </>
          )}

          {status === "closed" && (
            <button
              type="button"
              onClick={() =>
                onResults(survey)
              }
              className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Results
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SurveyDetail({
  survey,
  results,
  resultsLoading,
  onBack,
  onPublish,
  onClose,
  onResults,
  onTake,
  onEdit,
}) {
  const questions =
    Array.isArray(
      survey?.pulse_survey_questions,
    )
      ? survey.pulse_survey_questions
      : [];

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-4 inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to surveys
          </button>

          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <ClipboardList className="h-5 w-5" />
            </span>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-semibold text-ink-950">
                  {survey?.title}
                </h1>

                <StatusBadge
                  status={survey?.status}
                />
              </div>

              <p className="mt-1 max-w-2xl text-sm text-ink-500">
                {survey?.description ||
                  "No survey description."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {survey?.status === "draft" && (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
              >
                Edit details
              </button>

              <button
                type="button"
                onClick={() =>
                  onPublish(survey)
                }
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                <Send className="h-4 w-4" />
                Publish
              </button>
            </>
          )}

          {survey?.status ===
            "published" && (
            <>
              <button
                type="button"
                onClick={() =>
                  onTake(survey)
                }
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                <ClipboardList className="h-4 w-4" />
                Take survey
              </button>

              <button
                type="button"
                onClick={() =>
                  onClose(survey)
                }
                className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
              >
                Close survey
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          icon={ClipboardList}
          label="Questions"
          value={questions.length}
        />

        <MetricCard
          icon={BarChart3}
          label="Status"
          value={
            capitalize(survey?.status)
          }
        />

        <MetricCard
          icon={Sparkles}
          label="Responses"
          value={
            results?.totalResponses ??
            "—"
          }
        />
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-ink-100 px-5 py-4">
          <h2 className="text-base font-semibold text-ink-900">
            Survey questions
          </h2>

          <p className="mt-1 text-sm text-ink-500">
            Questions stored in the real
            pulse survey record.
          </p>
        </div>

        <div className="divide-y divide-ink-100">
          {questions.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-ink-400">
              No questions found.
            </div>
          ) : (
            questions.map(
              (question, index) => (
                <div
                  key={question.id}
                  className="px-5 py-5"
                >
                  <div className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-xs font-semibold text-ink-600">
                      {index + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-ink-900">
                          {
                            question.question_text
                          }
                        </p>

                        {question.required && (
                          <span className="text-xs text-red-500">
                            Required
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-xs text-ink-400">
                        {formatQuestionType(
                          question.question_type,
                        )}
                      </p>

                      {Array.isArray(
                        question.options,
                      ) &&
                        question.options.length >
                          0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {question.options.map(
                              (option) => (
                                <span
                                  key={option}
                                  className="rounded-full bg-ink-50 px-3 py-1 text-xs text-ink-600"
                                >
                                  {option}
                                </span>
                              ),
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              ),
            )
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-ink-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink-900">
              Survey results
            </h2>

            <p className="mt-1 text-sm text-ink-500">
              Response and sentiment data
              from the backend.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              onResults(survey)
            }
            disabled={resultsLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                resultsLoading
                  ? "animate-spin"
                  : ""
              }`}
            />
            Load results
          </button>
        </div>

        {resultsLoading ? (
          <div className="p-10 text-center text-sm text-ink-400">
            Loading results...
          </div>
        ) : results ? (
          <ResultsPanel results={results} />
        ) : (
          <div className="p-10 text-center text-sm text-ink-400">
            Click "Load results" to view
            response analytics.
          </div>
        )}
      </div>
    </div>
  );
}

function ResultsPanel({ results }) {
  const sentiment =
    results?.sentiment || {};

  const questionStats =
    Array.isArray(
      results?.questionStats,
    )
      ? results.questionStats
      : [];

  return (
    <div className="space-y-6 p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          icon={BarChart3}
          label="Responses"
          value={
            results?.totalResponses || 0
          }
        />

        <MetricCard
          icon={Sparkles}
          label="Positive"
          value={sentiment.positive || 0}
        />

        <MetricCard
          icon={Sparkles}
          label="Neutral"
          value={sentiment.neutral || 0}
        />

        <MetricCard
          icon={Sparkles}
          label="Negative"
          value={sentiment.negative || 0}
        />

        <MetricCard
          icon={Sparkles}
          label="Avg sentiment"
          value={
            sentiment.averageScore ??
            "—"
          }
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-ink-900">
          Question performance
        </h3>

        <div className="mt-3 overflow-x-auto rounded-lg border border-ink-100">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/50 text-left">
                <th className="px-4 py-3 font-medium text-ink-500">
                  Question
                </th>

                <th className="px-4 py-3 font-medium text-ink-500">
                  Type
                </th>

                <th className="px-4 py-3 font-medium text-ink-500">
                  Responses
                </th>

                <th className="px-4 py-3 font-medium text-ink-500">
                  Average rating
                </th>
              </tr>
            </thead>

            <tbody>
              {questionStats.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-ink-400"
                  >
                    No responses yet.
                  </td>
                </tr>
              ) : (
                questionStats.map(
                  (question) => (
                    <tr
                      key={
                        question.questionId
                      }
                      className="border-b border-ink-100 last:border-0"
                    >
                      <td className="max-w-md px-4 py-3 font-medium text-ink-900">
                        {
                          question.questionText
                        }
                      </td>

                      <td className="px-4 py-3 text-ink-600">
                        {formatQuestionType(
                          question.questionType,
                        )}
                      </td>

                      <td className="px-4 py-3 text-ink-600">
                        {
                          question.responseCount
                        }
                      </td>

                      <td className="px-4 py-3 text-ink-600">
                        {question.averageRating ??
                          "—"}
                      </td>
                    </tr>
                  ),
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TakeSurveyView({
  survey,
  answers,
  employeeId,
  setEmployeeId,
  setAnswer,
  toggleMultipleChoice,
  submitting,
  onSubmit,
  onBack,
}) {
  const questions =
    Array.isArray(
      survey?.pulse_survey_questions,
    )
      ? survey.pulse_survey_questions
      : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="card p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <ClipboardList className="h-5 w-5" />
          </span>

          <div>
            <h1 className="font-display text-2xl font-semibold text-ink-950">
              {survey?.title}
            </h1>

            <p className="mt-1 text-sm text-ink-500">
              {survey?.description ||
                "Please complete the survey below."}
            </p>

            <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-400">
              <span>
                {questions.length} questions
              </span>

              {survey?.is_anonymous && (
                <span>
                  Responses are anonymous
                </span>
              )}
            </div>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="mt-7 space-y-6"
        >
          {!survey?.is_anonymous && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <label className="block text-sm font-medium text-ink-800">
                Employee ID
              </label>

              <p className="mt-1 text-xs text-ink-500">
                This survey records the
                employee associated with the
                response.
              </p>

              <input
                value={employeeId}
                onChange={(event) =>
                  setEmployeeId(
                    event.target.value,
                  )
                }
                placeholder="Enter employee ID"
                className="mt-3 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </div>
          )}

          {questions.map(
            (question, index) => (
              <QuestionResponse
                key={question.id}
                question={question}
                index={index}
                value={
                  answers[question.id]
                }
                onChange={(value) =>
                  setAnswer(
                    question.id,
                    value,
                  )
                }
                onToggleMultiple={(
                  option,
                ) =>
                  toggleMultipleChoice(
                    question.id,
                    option,
                  )
                }
              />
            ),
          )}

          <div className="flex justify-end border-t border-ink-100 pt-5">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {submitting
                ? "Submitting..."
                : "Submit response"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function QuestionResponse({
  question,
  index,
  value,
  onChange,
  onToggleMultiple,
}) {
  const type =
    question?.question_type;

  return (
    <div className="rounded-xl border border-ink-100 p-5">
      <div className="flex gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-xs font-semibold text-ink-600">
          {index + 1}
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink-900">
            {question?.question_text}
            {question?.required && (
              <span className="ml-1 text-red-500">
                *
              </span>
            )}
          </p>

          <div className="mt-4">
            {type === "text" && (
              <textarea
                value={value || ""}
                onChange={(event) =>
                  onChange(
                    event.target.value,
                  )
                }
                rows={4}
                placeholder="Type your response..."
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            )}

            {type === "rating" && (
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map(
                  (rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() =>
                        onChange(rating)
                      }
                      className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-medium ${
                        Number(value) ===
                        rating
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50"
                      }`}
                    >
                      {rating}
                    </button>
                  ),
                )}
              </div>
            )}

            {type ===
              "single_choice" && (
              <div className="space-y-2">
                {(
                  question.options || []
                ).map((option) => (
                  <label
                    key={option}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-ink-100 px-3 py-3 hover:bg-ink-50"
                  >
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      checked={
                        value === option
                      }
                      onChange={() =>
                        onChange(option)
                      }
                    />

                    <span className="text-sm text-ink-700">
                      {option}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {type ===
              "multiple_choice" && (
              <div className="space-y-2">
                {(
                  question.options || []
                ).map((option) => {
                  const selected =
                    Array.isArray(
                      value,
                    ) &&
                    value.includes(option);

                  return (
                    <label
                      key={option}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-ink-100 px-3 py-3 hover:bg-ink-50"
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() =>
                          onToggleMultiple(
                            option,
                          )
                        }
                      />

                      <span className="text-sm text-ink-700">
                        {option}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateSurveyModal({
  form,
  saving,
  onClose,
  onSubmit,
  onChange,
  onAddQuestion,
  onRemoveQuestion,
  onUpdateQuestion,
  onUpdateOption,
  onAddOption,
  onRemoveOption,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-ink-950">
              Create pulse survey
            </h2>

            <p className="mt-1 text-sm text-ink-500">
              Build a short employee pulse
              using real survey records.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="overflow-y-auto"
        >
          <div className="space-y-6 p-6">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-ink-800">
                  Survey title
                </label>

                <input
                  value={form.title}
                  onChange={(event) =>
                    onChange(
                      "title",
                      event.target.value,
                    )
                  }
                  placeholder="e.g. August Employee Pulse"
                  className="mt-2 w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-ink-800">
                  Description
                </label>

                <textarea
                  value={form.description}
                  onChange={(event) =>
                    onChange(
                      "description",
                      event.target.value,
                    )
                  }
                  rows={3}
                  placeholder="What would you like employees to reflect on?"
                  className="mt-2 w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-800">
                  Start time
                </label>

                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(event) =>
                    onChange(
                      "startsAt",
                      event.target.value,
                    )
                  }
                  className="mt-2 w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-800">
                  End time
                </label>

                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(event) =>
                    onChange(
                      "endsAt",
                      event.target.value,
                    )
                  }
                  className="mt-2 w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-100 bg-ink-50/50 p-4">
              <input
                type="checkbox"
                checked={form.isAnonymous}
                onChange={(event) =>
                  onChange(
                    "isAnonymous",
                    event.target.checked,
                  )
                }
                className="mt-0.5"
              />

              <span>
                <span className="block text-sm font-medium text-ink-900">
                  Anonymous responses
                </span>

                <span className="mt-1 block text-xs text-ink-500">
                  Employee identity will not
                  be stored with the survey
                  response.
                </span>
              </span>
            </label>

            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-ink-900">
                    Questions
                  </h3>

                  <p className="mt-1 text-xs text-ink-500">
                    Add the questions employees
                    will answer.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onAddQuestion}
                  className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add question
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {form.questions.map(
                  (question, index) => (
                    <QuestionEditor
                      key={index}
                      question={question}
                      index={index}
                      onRemove={() =>
                        onRemoveQuestion(
                          index,
                        )
                      }
                      onUpdate={(field, value) =>
                        onUpdateQuestion(
                          index,
                          field,
                          value,
                        )
                      }
                      onUpdateOption={(
                        optionIndex,
                        value,
                      ) =>
                        onUpdateOption(
                          index,
                          optionIndex,
                          value,
                        )
                      }
                      onAddOption={() =>
                        onAddOption(index)
                      }
                      onRemoveOption={(
                        optionIndex,
                      ) =>
                        onRemoveOption(
                          index,
                          optionIndex,
                        )
                      }
                    />
                  ),
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-ink-100 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {saving
                ? "Creating..."
                : "Create draft"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function QuestionEditor({
  question,
  index,
  onRemove,
  onUpdate,
  onUpdateOption,
  onAddOption,
  onRemoveOption,
}) {
  const needsOptions =
    question.question_type ===
      "single_choice" ||
    question.question_type ===
      "multiple_choice";

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-xs font-semibold text-ink-600">
          {index + 1}
        </span>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              value={question.question_text}
              onChange={(event) =>
                onUpdate(
                  "question_text",
                  event.target.value,
                )
              }
              placeholder="Enter question..."
              className="rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500 md:col-span-2"
            />

            <select
              value={
                question.question_type
              }
              onChange={(event) =>
                onUpdate(
                  "question_type",
                  event.target.value,
                )
              }
              className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
            >
              {QUESTION_TYPES.map(
                (type) => (
                  <option
                    key={type.value}
                    value={type.value}
                  >
                    {type.label}
                  </option>
                ),
              )}
            </select>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-ink-600">
            <input
              type="checkbox"
              checked={
                question.required !== false
              }
              onChange={(event) =>
                onUpdate(
                  "required",
                  event.target.checked,
                )
              }
            />
            Required question
          </label>

          {question.question_type ===
            "rating" && (
            <div className="rounded-lg bg-ink-50 p-3 text-xs text-ink-500">
              Employees will rate this
              question from 1 to 5.
            </div>
          )}

          {question.question_type ===
            "text" && (
            <div className="rounded-lg bg-ink-50 p-3 text-xs text-ink-500">
              Employees will enter a free-text
              response.
            </div>
          )}

          {needsOptions && (
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-600">
                  Options
                </span>

                <button
                  type="button"
                  onClick={onAddOption}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  + Add option
                </button>
              </div>

              <div className="mt-2 space-y-2">
                {(
                  question.options || []
                ).map(
                  (option, optionIndex) => (
                    <div
                      key={optionIndex}
                      className="flex items-center gap-2"
                    >
                      <input
                        value={option}
                        onChange={(event) =>
                          onUpdateOption(
                            optionIndex,
                            event.target
                              .value,
                          )
                        }
                        placeholder={`Option ${
                          optionIndex + 1
                        }`}
                        className="flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          onRemoveOption(
                            optionIndex,
                          )
                        }
                        className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600"
          title="Remove question"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-ink-400">
            {label}
          </p>

          <p className="mt-2 text-2xl font-semibold text-ink-950">
            {value}
          </p>
        </div>

        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-50 text-ink-600">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    draft:
      "bg-amber-50 text-amber-700",
    published:
      "bg-emerald-50 text-emerald-700",
    closed:
      "bg-ink-100 text-ink-600",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        styles[status] ||
        "bg-ink-100 text-ink-600"
      }`}
    >
      {capitalize(status || "unknown")}
    </span>
  );
}

function formatQuestionType(type) {
  const match = QUESTION_TYPES.find(
    (item) => item.value === type,
  );

  return (
    match?.label ||
    capitalize(
      String(type || "unknown").replace(
        /_/g,
        " ",
      ),
    )
  );
}

function capitalize(value) {
  if (!value) return "";

  return (
    String(value)
      .charAt(0)
      .toUpperCase() +
    String(value).slice(1)
  );
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(
    undefined,
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  );
}